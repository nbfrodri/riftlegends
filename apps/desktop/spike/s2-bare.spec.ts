// SPIKE S2 (#74), THROW-AWAY: control run with NO key/focus/mutation hooks in
// the page, only a rAF frame sampler, to show that the instrumentation of
// s2-dense-table.spec.ts is not what costs the frames. Holds ArrowDown at
// ~30 Hz (300 keys) and reports frame stats plus how long after the last key
// the focus reaches the expected row (backlog drain).

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

const variant = process.env.S2_VARIANT ?? "plain";
const outDir = process.env.S2_OUT ?? join(process.cwd(), "spike-out");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (v: number[], q: number) => {
	const a = [...v].sort((x, y) => x - y);
	return a[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)] as number;
};

test("S2 bare control", async ({ playwright }) => {
	test.setTimeout(10 * 60_000);
	mkdirSync(outDir, { recursive: true });
	const app = await playwright._electron.launch({
		args: [
			".",
			"--ozone-platform=wayland",
			`--user-data-dir=${join(outDir, "profile-bare")}`,
			"--lang=en-US",
		],
		chromiumSandbox: true,
	});
	const page = await app.firstWindow();
	await sleep(1500);
	const pid = app.process().pid;
	const c = (
		JSON.parse(
			execFileSync("hyprctl", ["clients", "-j"], { encoding: "utf8" }),
		) as { pid: number; address: string }[]
	).find((x) => x.pid === pid);
	if (c) {
		const w = `window = "address:${c.address}"`;
		execFileSync("hyprctl", [
			"dispatch",
			`hl.dsp.window.float({ action = "enable", ${w} })`,
		]);
		execFileSync("hyprctl", [
			"dispatch",
			`hl.dsp.window.resize({ x = 1366, y = 768, ${w} })`,
		]);
	}
	await sleep(1000);
	await page
		.getByRole("navigation", { name: "Club sections" })
		.getByRole("button", { name: "Market" })
		.click();
	await page.waitForSelector("tbody tr[data-row-id]");
	await page.evaluate(() => {
		(document.querySelector("tbody tr[data-row-id]") as HTMLElement).focus();
	});

	const rows: Record<string, unknown>[] = [];
	for (let rep = 0; rep < 4; rep++) {
		await page.keyboard.press("Home");
		await sleep(500);
		await page.evaluate(() => {
			const w = window as unknown as { f: number[]; on: boolean };
			w.f = [];
			w.on = true;
			const loop = (t: number) => {
				if (!w.on) return;
				w.f.push(t);
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		});
		const n = 300;
		const period = 33;
		const start = Date.now();
		for (let i = 0; i < n; i++) {
			await page.keyboard.down("ArrowDown");
			const wait = start + (i + 1) * period - Date.now();
			if (wait > 0) await sleep(wait);
		}
		await page.keyboard.up("ArrowDown");
		const lastKeyAt = Date.now();
		// Backlog drain: time until the focus reaches the 301st row (index 300).
		let drained = -1;
		for (let i = 0; i < 400; i++) {
			const idx = await page.evaluate(() =>
				Number(
					(document.activeElement as HTMLElement | null)?.dataset.index ?? -1,
				),
			);
			if (idx === n) {
				drained = Date.now() - lastKeyAt;
				break;
			}
			await sleep(25);
		}
		const { f, id } = await page.evaluate(() => {
			const w = window as unknown as { f: number[]; on: boolean };
			w.on = false;
			return {
				f: w.f,
				id: (document.activeElement as HTMLElement | null)?.dataset.rowId,
			};
		});
		const iv = f.slice(1).map((t, i) => t - (f[i] as number));
		const span = (f.at(-1) as number) - (f[0] as number);
		rows.push({
			variant,
			rep,
			keys: n,
			frames: f.length,
			fps: ((f.length - 1) / span) * 1000,
			interval_p95: pct(iv, 0.95),
			interval_max: Math.max(...iv),
			drain_ms_after_last_key: drained,
			final_id: id,
		});
	}
	console.log(JSON.stringify(rows, null, 2));
	writeFileSync(
		join(outDir, `${variant}-bare.json`),
		JSON.stringify(rows, null, 2),
	);
	await app.close();
});
