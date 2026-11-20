// SPIKE S2 (#74), THROW-AWAY: keyboard-only measurement of the Mercado table
// with 500 fictional players on the production build (electron-vite build) under
// native Wayland. Output: raw CSVs + summary.json in S2_OUT.
//
//   S2_VARIANT=plain|virtual  S2_OUT=<dir>  pnpm exec playwright test -c spike/playwright.config.ts

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { generatePlayers } from "../src/renderer/spike-players";

const variant = process.env.S2_VARIANT ?? "plain";
const outDir = process.env.S2_OUT ?? join(process.cwd(), "spike-out");
const measuredRuns = Number(process.env.S2_RUNS ?? 3);
const players = generatePlayers();
const collator = new Intl.Collator("en-US");

type Column = "name" | "rating";
const raw = (p: (typeof players)[number], column: Column) => p[column];
function expectedOrder(
	list: typeof players,
	column?: Column,
	dir: "asc" | "desc" = "asc",
) {
	const indexed = list.map((p, index) => ({ p, index }));
	if (column) {
		indexed.sort((a, b) => {
			const [x, y] = [raw(a.p, column), raw(b.p, column)];
			const r =
				typeof x === "number" && typeof y === "number"
					? x - y
					: collator.compare(String(x), String(y));
			if (r !== 0) return dir === "desc" ? -r : r;
			return a.index - b.index;
		});
	}
	return indexed.map(({ p }) => p.id);
}

// In-page instrumentation. Everything is measured with performance.now().
// latency = time from the keydown event (event.timeStamp) until the first task
// after the requestAnimationFrame callback that follows the visible result.
const instrument = () => {
	type Rec = Record<string, unknown>;
	const S = {
		phase: "idle",
		keys: [] as Rec[],
		frames: [] as { phase: string; t: number }[],
		queue: [] as { t0: number; key: string; phase: string }[],
		pending: 0,
		armed: null as null | {
			t0: number | null;
			key: string;
			phase: string;
			pred: Rec;
			resolve: () => void;
		},
		eventTiming: [] as { startTime: number; duration: number; name: string }[],
		drain: [] as (() => void)[],
	};
	(window as unknown as { __s: typeof S }).__s = S;
	const mc = new MessageChannel();
	const afterFrame: (() => void)[] = [];
	mc.port1.onmessage = () => {
		const fn = afterFrame.shift();
		fn?.();
	};
	const stampAfterFrame = (cb: (tFrame: number, tRaf: number) => void) => {
		requestAnimationFrame((tRaf) => {
			afterFrame.push(() => cb(performance.now(), tRaf));
			mc.port2.postMessage(0);
		});
	};
	const region = () =>
		document.querySelector<HTMLElement>("[role=region][aria-label]");
	const visibility = (el: Element | null) => {
		const row = el?.closest<HTMLElement>("tr[data-row-id]");
		const box = region();
		if (!row || !box) return { id: null, inView: false, outline: false };
		const header = document.querySelector("thead");
		const top = header ? header.getBoundingClientRect().bottom : 0;
		const r = row.getBoundingClientRect();
		const b = box.getBoundingClientRect();
		const style = getComputedStyle(row);
		return {
			id: row.dataset.rowId ?? null,
			inView: r.top >= top - 0.5 && r.bottom <= b.bottom + 0.5,
			outline:
				style.outlineStyle === "solid" &&
				Number.parseFloat(style.outlineWidth) > 0 &&
				row.matches(":focus-visible"),
		};
	};
	const settle = () => {
		if (S.pending === 0 && S.drain.length) {
			const fns = S.drain.splice(0);
			for (const fn of fns) fn();
		}
	};

	document.addEventListener(
		"keydown",
		(e) => {
			const item = { t0: e.timeStamp, key: e.key, phase: S.phase };
			if (S.armed && S.armed.t0 === null) S.armed.t0 = e.timeStamp;
			else if (/^(Arrow|Home|End|Page)/.test(e.key)) S.queue = [item];
		},
		true,
	);
	// The focus change happens synchronously inside the keydown dispatch, so the
	// pending item is dropped once the event has bubbled to window.
	window.addEventListener("keydown", () => {
		S.queue = [];
	});
	document.addEventListener("focusin", (e) => {
		const el = e.target as Element;
		if (!el.matches?.("tr[data-row-id]")) return;
		const item = S.queue.shift();
		if (!item) return;
		S.pending++;
		const tFocus = performance.now();
		stampAfterFrame((tFrame, tRaf) => {
			const v = visibility(document.activeElement);
			S.keys.push({
				kind: "focus",
				phase: item.phase,
				key: item.key,
				t0: item.t0,
				tFocus,
				tRaf,
				tFrame,
				latency: tFrame - item.t0,
				...v,
				hasFocus: document.hasFocus(),
			});
			S.pending--;
			settle();
		});
	});

	const check = () => {
		const a = S.armed;
		if (!a || a.t0 === null) return;
		const p = a.pred as {
			firstRow?: string;
			sort?: { col: string; dir: string };
			status?: string;
			rows?: number;
			value?: string;
		};
		if (
			p.value !== undefined &&
			document.querySelector<HTMLInputElement>("input[type=search]")?.value !==
				p.value
		)
			return;
		const status = document.querySelector("[role=status]")?.textContent ?? "";
		if (p.rows !== undefined && Number.parseInt(status, 10) !== p.rows) return;
		const first = document.querySelector<HTMLElement>(
			'tbody tr[data-index="0"]',
		);
		if (p.firstRow && first?.dataset.rowId !== p.firstRow) return;
		if (p.sort) {
			const th = [...document.querySelectorAll("thead th")].find((h) =>
				h.textContent?.includes(p.sort?.col ?? ""),
			);
			if (th?.getAttribute("aria-sort") !== p.sort.dir) return;
		}
		if (p.status) {
			const s = document.querySelector("[role=status]")?.textContent ?? "";
			if (!s.includes(p.status)) return;
		}
		S.armed = null;
		const t0 = a.t0;
		S.pending++;
		const tDom = performance.now();
		stampAfterFrame((tFrame, tRaf) => {
			S.keys.push({
				kind: "action",
				phase: a.phase,
				key: a.key,
				t0,
				tFocus: tDom,
				tRaf,
				tFrame,
				latency: tFrame - t0,
			});
			S.pending--;
			a.resolve();
			settle();
		});
	};
	new MutationObserver(check).observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});
	document.addEventListener("input", () => queueMicrotask(check), true);
	document.addEventListener("keydown", () => queueMicrotask(check), true);

	// Event Timing API: keydown start to the next presented frame, 8 ms grain.
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			const t = e as PerformanceEventTiming;
			S.eventTiming.push({
				startTime: t.startTime,
				duration: t.duration,
				name: t.name,
			});
		}
	}).observe({
		type: "event",
		durationThreshold: 16,
		buffered: true,
	} as PerformanceObserverInit);

	// Continuous frame sampler.
	const loop = (t: number) => {
		S.frames.push({ phase: S.phase, t });
		requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);

	Object.assign(S, {
		arm: (key: string, pred: Rec) =>
			new Promise<void>((resolve) => {
				S.armed = { t0: null, key, phase: S.phase, pred, resolve };
			}),
		whenIdle: () =>
			new Promise<void>((resolve) => {
				if (S.pending === 0) resolve();
				else S.drain.push(resolve);
			}),
		reset: () => {
			S.keys = [];
			S.frames = [];
			S.queue = [];
		},
		snapshot: () => ({ keys: S.keys, frames: S.frames, et: S.eventTiming }),
		order: () => ({
			total: Number.parseInt(
				document.querySelector("[role=status]")?.textContent ?? "",
				10,
			),
			pairs: [
				...document.querySelectorAll<HTMLElement>("tbody tr[data-row-id]"),
			].map((r) => [Number(r.dataset.index), r.dataset.rowId ?? ""]),
		}),
		active: () => visibility(document.activeElement),
	});
};

type Sample = {
	kind: string;
	phase: string;
	key: string;
	t0: number;
	tFrame: number;
	latency: number;
	id?: string | null;
	inView?: boolean;
	outline?: boolean;
	hasFocus?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const S = "window.__s" as const;
void S;

async function s<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
	return page.evaluate(
		({ fn, args }) =>
			(
				(window as unknown as { __s: Record<string, (...a: unknown[]) => T> })
					.__s[fn] as (...a: unknown[]) => T
			)(...args),
		{ fn, args },
	);
}

const percentile = (values: number[], q: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	if (!sorted.length) return Number.NaN;
	const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
	return sorted[idx] as number;
};

test("S2 dense table, keyboard only", async ({ playwright }) => {
	test.setTimeout(30 * 60_000);
	mkdirSync(outDir, { recursive: true });
	const app = await playwright._electron.launch({
		args: [
			".",
			"--ozone-platform=wayland",
			"--enable-features=UseOzonePlatform",
			`--user-data-dir=${join(outDir, "profile")}`,
			"--lang=en-US",
		],
		chromiumSandbox: true,
	});
	const page = await app.firstWindow();
	const pid = app.process().pid;

	// Float the window and force 1366x768 (Hyprland tiles by default).
	await sleep(1500);
	const clients = JSON.parse(
		execFileSync("hyprctl", ["clients", "-j"], { encoding: "utf8" }),
	) as { pid: number; address: string; xwayland: boolean; class: string }[];
	const client = clients.find((c) => c.pid === pid);
	const hypr = (code: string) =>
		execFileSync("hyprctl", ["dispatch", code], { encoding: "utf8" });
	if (client) {
		const w = `window = "address:${client.address}"`;
		console.log(hypr(`hl.dsp.window.float({ action = "enable", ${w} })`));
		console.log(hypr(`hl.dsp.window.resize({ x = 1366, y = 768, ${w} })`));
		console.log(hypr(`hl.dsp.window.center({ ${w} })`));
	}
	await sleep(1000);
	const env = await page.evaluate(() => ({
		w: innerWidth,
		h: innerHeight,
		dpr: devicePixelRatio,
		ua: navigator.userAgent,
	}));
	const clientAfter = (
		JSON.parse(
			execFileSync("hyprctl", ["clients", "-j"], { encoding: "utf8" }),
		) as { pid: number; xwayland: boolean; size: number[]; floating: boolean }[]
	).find((c) => c.pid === pid);
	const gpu = await app.evaluate(({ app }) => app.getGPUFeatureStatus());
	const info = {
		variant,
		env,
		hyprland: clientAfter,
		gpu,
		electron: process.versions,
	};
	console.log(JSON.stringify(info));

	await page.waitForSelector("main");
	await page.evaluate(instrument);

	// Keyboard helpers ---------------------------------------------------
	const key = (k: string) => page.keyboard.press(k);
	const activeNav = () =>
		page.evaluate(() => {
			const el = document.activeElement;
			return el?.closest("nav") ? (el.getAttribute("aria-label") ?? "") : "";
		});
	const goTo = async (label: "Draft" | "Market") => {
		for (let i = 0; i < 40 && !(await activeNav()); i++) await key("Tab");
		for (let i = 0; i < 14 && (await activeNav()) !== label; i++)
			await key("ArrowDown");
		if ((await activeNav()) !== label)
			throw new Error(`nav ${label} not reached`);
		await key("Enter");
		await page.waitForFunction(
			(l) =>
				document
					.querySelector(`nav [aria-label="${l}"]`)
					?.getAttribute("aria-current") === "page",
			label,
		);
	};
	const tabTo = async (selector: string, back = false) => {
		for (let i = 0; i < 40; i++) {
			const ok = await page.evaluate(
				(sel) => document.activeElement?.matches(sel) ?? false,
				selector,
			);
			if (ok) return;
			await key(back ? "Shift+Tab" : "Tab");
		}
		throw new Error(`Tab never reached ${selector}`);
	};
	const arm = (k: string, pred: Record<string, unknown>) =>
		s<Promise<void>>(page, "arm", k, pred);
	const act = async (k: string, pred: Record<string, unknown>) => {
		const done = page.evaluate(
			({ k, pred }) =>
				(
					window as unknown as {
						__s: { arm: (k: string, p: unknown) => Promise<void> };
					}
				).__s.arm(k, pred),
			{ k, pred },
		);
		await sleep(30);
		await key(k);
		await done;
	};
	void arm;
	const phase = (name: string) =>
		page.evaluate((n) => {
			(window as unknown as { __s: { phase: string } }).__s.phase = n;
		}, name);
	const checks: { name: string; ok: boolean; detail?: string | undefined }[] =
		[];
	const check = (name: string, ok: boolean, detail?: string) => {
		checks.push({ name, ok, detail });
		if (!ok) console.log(`CHECK FAILED: ${name} ${detail ?? ""}`);
	};
	type Order = { total: number; pairs: [number, string][] };
	const domOrder = () => s<Order>(page, "order");
	// Every mounted row must sit at its expected index; without virtualization
	// all of them must be mounted, with it only a window.
	const sameOrder = (o: Order, expected: string[]) =>
		o.total === expected.length &&
		o.pairs.length > 0 &&
		o.pairs.every(([i, id]) => expected[i] === id) &&
		(variant === "virtual" || o.pairs.length === expected.length);
	const activeInfo = () =>
		s<{ id: string | null; inView: boolean; outline: boolean }>(page, "active");

	const allKeys: (Sample & { run: number })[] = [];
	const allFrames: { run: number; phase: string; t: number }[] = [];
	const allEt: { run: number; startTime: number; duration: number }[] = [];
	const phaseWindows: { run: number; phase: string; t0: number; t1: number }[] =
		[];

	const total = 1 + measuredRuns;
	for (let run = 0; run < total; run++) {
		await s(page, "reset");
		await page.evaluate(() => {
			(
				window as unknown as { __s: { eventTiming: unknown[] } }
			).__s.eventTiming = [];
		});
		const label = run === 0 ? "warmup" : `run${run}`;
		console.log(`--- ${label}`);
		await phase("nav");
		await goTo("Draft");
		await goTo("Market");
		await page.waitForSelector("tbody tr[data-row-id]");
		let order = await domOrder();
		check(
			`${label}: initial order is ID order`,
			sameOrder(order, expectedOrder(players)),
		);
		check(
			`${label}: 500 rows rendered`,
			order.total === 500 &&
				(variant === "virtual" || order.pairs.length === 500),
			`${order.total} total, ${order.pairs.length} mounted`,
		);

		(info as Record<string, unknown>).mountedRows = order.pairs.length;

		const mark = async (name: string, fn: () => Promise<void>) => {
			await phase(name);
			const t0 = await page.evaluate(() => performance.now());
			await fn();
			await s(page, "whenIdle");
			const t1 = await page.evaluate(() => performance.now());
			phaseWindows.push({ run, phase: name, t0, t1 });
		};

		// Sort ------------------------------------------------------------
		await mark("sort", async () => {
			await tabTo("thead th:nth-child(5) button"); // rating
			const asc = expectedOrder(players, "rating", "asc");
			await act("Enter", {
				sort: { col: "Rating", dir: "ascending" },
				firstRow: asc[0],
			});
			check(`${label}: rating asc order`, sameOrder(await domOrder(), asc));
			const desc = expectedOrder(players, "rating", "desc");
			await act("Enter", {
				sort: { col: "Rating", dir: "descending" },
				firstRow: desc[0],
			});
			check(`${label}: rating desc order`, sameOrder(await domOrder(), desc));
		});
		void 0;
		await mark("sort-name", async () => {
			// Focus is on the rating header; move back to name with Shift+Tab.
			for (let i = 0; i < 6; i++) {
				const on = await page.evaluate(
					() => document.activeElement?.closest("th")?.textContent ?? "",
				);
				if (on.includes("Player")) break;
				await key("Shift+Tab");
			}
			const asc = expectedOrder(players, "name", "asc");
			await act("Enter", {
				sort: { col: "Player", dir: "ascending" },
				firstRow: asc[0],
			});
			check(`${label}: name asc order`, sameOrder(await domOrder(), asc));
		});

		// Filter ----------------------------------------------------------
		const filtered = players.filter((p) => p.team === "Bruma");
		await mark("filter", async () => {
			await tabTo("input[type=search]", true);
			const want = expectedOrder(filtered, "name", "asc");
			for (const ch of "bruma") {
				const typed = "bruma".slice(0, "bruma".indexOf(ch) + 1);
				await act(
					ch,
					ch === "a" ? { value: "bruma", rows: want.length } : { value: typed },
				);
			}
		});
		order = await domOrder();
		check(
			`${label}: filter result == expected (name asc)`,
			sameOrder(order, expectedOrder(filtered, "name", "asc")),
			`${order.total} vs ${filtered.length}`,
		);

		// Arrow through the filtered rows, End, Home --------------------------
		await mark("filtered-nav", async () => {
			await tabTo("tbody tr[data-row-id]");
			const want = expectedOrder(filtered, "name", "asc");
			let a = await activeInfo();
			check(
				`${label}: Tab lands on first filtered row`,
				a.id === want[0],
				String(a.id),
			);
			for (let i = 1; i < Math.min(8, want.length); i++) {
				await key("ArrowDown");
				await s(page, "whenIdle");
				a = await activeInfo();
				check(
					`${label}: filtered ArrowDown ${i}`,
					a.id === want[i] && a.inView && a.outline,
					JSON.stringify(a),
				);
			}
			await key("End");
			await s(page, "whenIdle");
			a = await activeInfo();
			check(
				`${label}: filtered End`,
				a.id === want.at(-1) && a.inView && a.outline,
				JSON.stringify(a),
			);
			await key("Home");
			await s(page, "whenIdle");
			a = await activeInfo();
			check(
				`${label}: filtered Home`,
				a.id === want[0] && a.inView && a.outline,
				JSON.stringify(a),
			);
		});

		// Clear filter ----------------------------------------------------
		await mark("clear", async () => {
			await tabTo("input[type=search]", true);
			await key("Control+a");
			await act("Backspace", { value: "", rows: 500 });
			const want = expectedOrder(players, "name", "asc");
			check(
				`${label}: clear restores 500 in name order`,
				sameOrder(await domOrder(), want),
			);
		});

		// Walk with ArrowDown through all 500 rows (isolated presses) ----------
		const want = expectedOrder(players, "name", "asc");
		await mark("arrow-isolated", async () => {
			await tabTo("tbody tr[data-row-id]");
			await s(page, "whenIdle");
			let a = await activeInfo();
			check(
				`${label}: tab stop stays on the last active player`,
				a.id === expectedOrder(filtered, "name", "asc")[0],
				String(a.id),
			);
			await key("Home");
			await s(page, "whenIdle");
			a = await activeInfo();
			check(
				`${label}: Home reaches first row`,
				a.id === want[0] && a.inView && a.outline,
				JSON.stringify(a),
			);
			for (let i = 1; i < 500; i++) {
				await key("ArrowDown");
				await sleep(12);
			}
			await s(page, "whenIdle");
			a = await activeInfo();
			check(
				`${label}: ArrowDown x499 ends on row 500`,
				a.id === want[499] && a.inView && a.outline,
				JSON.stringify(a),
			);
		});

		// Home / End jumps ------------------------------------------------
		await mark("home-end", async () => {
			for (let i = 0; i < 20; i++) {
				await key("Home");
				await sleep(120);
				await s(page, "whenIdle");
				let a = await activeInfo();
				check(
					`${label}: Home #${i}`,
					a.id === want[0] && a.inView && a.outline,
					JSON.stringify(a),
				);
				await key("End");
				await sleep(120);
				await s(page, "whenIdle");
				a = await activeInfo();
				check(
					`${label}: End #${i}`,
					a.id === want[499] && a.inView && a.outline,
					JSON.stringify(a),
				);
			}
			await key("Home");
			await s(page, "whenIdle");
		});

		// Held key (auto-repeat) -----------------------------------------------
		await mark("arrow-hold", async () => {
			const period = 33; // ~30 Hz, a typical OS repeat rate
			const n = 300;
			const start = Date.now();
			for (let i = 0; i < n; i++) {
				await page.keyboard.down("ArrowDown");
				const wait = start + (i + 1) * period - Date.now();
				if (wait > 0) await sleep(wait);
			}
			await page.keyboard.up("ArrowDown");
			await sleep(200);
			await s(page, "whenIdle");
			const a = await activeInfo();
			check(
				`${label}: hold x300 ends on row 301`,
				a.id === want[300] && a.inView && a.outline,
				JSON.stringify(a),
			);
			await key("Home");
			await s(page, "whenIdle");
			// Hold ArrowUp from the bottom too.
			await key("End");
			await s(page, "whenIdle");
			const t = Date.now();
			for (let i = 0; i < n; i++) {
				await page.keyboard.down("ArrowUp");
				const wait = t + (i + 1) * period - Date.now();
				if (wait > 0) await sleep(wait);
			}
			await page.keyboard.up("ArrowUp");
			await sleep(200);
			await s(page, "whenIdle");
			const b = await activeInfo();
			check(
				`${label}: hold up x300 ends on row 200`,
				b.id === want[199] && b.inView && b.outline,
				JSON.stringify(b),
			);
		});

		const snap = await s<{
			keys: Sample[];
			frames: { phase: string; t: number }[];
			et: { startTime: number; duration: number; name: string }[];
		}>(page, "snapshot");
		for (const k of snap.keys) allKeys.push({ run, ...k });
		for (const f of snap.frames) allFrames.push({ run, ...f });
		for (const e of snap.et)
			if (e.name === "keydown")
				allEt.push({ run, startTime: e.startTime, duration: e.duration });
	}

	// Output -------------------------------------------------------------
	const csv = (rows: Record<string, unknown>[]) => {
		if (!rows.length) return "";
		const head = Object.keys(rows[0] as object);
		return [
			head.join(","),
			...rows.map((r) => head.map((h) => String(r[h] ?? "")).join(",")),
		].join("\n");
	};
	writeFileSync(
		join(outDir, `${variant}-latency.csv`),
		csv(
			allKeys.map((k) => ({
				run: k.run,
				phase: k.phase,
				kind: k.kind,
				key: k.key,
				t0_ms: k.t0.toFixed(2),
				tFrame_ms: k.tFrame.toFixed(2),
				latency_ms: k.latency.toFixed(2),
				id: k.id ?? "",
				inView: k.inView ?? "",
				outline: k.outline ?? "",
				hasFocus: k.hasFocus ?? "",
			})),
		),
	);
	// Frame intervals within each phase window.
	const frameRows: Record<string, unknown>[] = [];
	for (const w of phaseWindows) {
		const fs = allFrames
			.filter((f) => f.run === w.run && f.t >= w.t0 && f.t <= w.t1)
			.map((f) => f.t);
		for (let i = 1; i < fs.length; i++)
			frameRows.push({
				run: w.run,
				phase: w.phase,
				t_ms: (fs[i] as number).toFixed(2),
				interval_ms: ((fs[i] as number) - (fs[i - 1] as number)).toFixed(2),
			});
	}
	writeFileSync(join(outDir, `${variant}-frames.csv`), csv(frameRows));
	writeFileSync(
		join(outDir, `${variant}-eventtiming.csv`),
		csv(allEt.map((e) => ({ ...e }))),
	);

	const summary: Record<string, unknown> = { info, checks: {} };
	const failed = checks.filter((c) => !c.ok);
	(summary.checks as Record<string, unknown>) = {
		total: checks.length,
		failed: failed.length,
		failures: failed.slice(0, 40),
	};
	const scrollPhases = [
		"arrow-isolated",
		"home-end",
		"arrow-hold",
		"filtered-nav",
	];
	const perRun: Record<string, unknown>[] = [];
	for (let run = 1; run <= measuredRuns; run++) {
		const row: Record<string, unknown> = { run };
		for (const ph of [
			...scrollPhases,
			"sort",
			"sort-name",
			"filter",
			"clear",
		]) {
			const lat = allKeys
				.filter((k) => k.run === run && k.phase === ph)
				.map((k) => k.latency);
			row[`${ph}.n`] = lat.length;
			row[`${ph}.latency.p50`] = percentile(lat, 0.5);
			row[`${ph}.latency.p95`] = percentile(lat, 0.95);
			row[`${ph}.latency.max`] = Math.max(...lat);
		}
		const scrollLat = allKeys
			.filter((k) => k.run === run && scrollPhases.includes(k.phase))
			.map((k) => k.latency);
		row["scroll.latency.n"] = scrollLat.length;
		row["scroll.latency.p50"] = percentile(scrollLat, 0.5);
		row["scroll.latency.p95"] = percentile(scrollLat, 0.95);
		row["scroll.latency.max"] = Math.max(...scrollLat);
		row["scroll.badFocus"] = allKeys.filter(
			(k) =>
				k.run === run &&
				scrollPhases.includes(k.phase) &&
				(!k.inView || !k.outline),
		).length;
		for (const ph of [...scrollPhases, "scroll-all"]) {
			const wins = phaseWindows.filter(
				(w) =>
					w.run === run &&
					(ph === "scroll-all"
						? scrollPhases.includes(w.phase)
						: w.phase === ph),
			);
			const intervals: number[] = [];
			let frames = 0;
			let span = 0;
			for (const w of wins) {
				const fs = allFrames
					.filter((f) => f.run === run && f.t >= w.t0 && f.t <= w.t1)
					.map((f) => f.t);
				for (let i = 1; i < fs.length; i++)
					intervals.push((fs[i] as number) - (fs[i - 1] as number));
				frames += Math.max(0, fs.length - 1);
				span += fs.length > 1 ? (fs.at(-1) as number) - (fs[0] as number) : 0;
			}
			row[`${ph}.fps`] = span ? (frames / span) * 1000 : Number.NaN;
			row[`${ph}.interval.p95`] = percentile(intervals, 0.95);
			row[`${ph}.interval.max`] = Math.max(...intervals);
		}
		const et = allEt.filter((e) => e.run === run).map((e) => e.duration);
		row["eventTiming.n"] = et.length;
		row["eventTiming.max"] = et.length ? Math.max(...et) : 0;
		perRun.push(row);
	}
	summary.perRun = perRun;
	writeFileSync(
		join(outDir, `${variant}-summary.json`),
		JSON.stringify(summary, null, 2),
	);
	console.log(JSON.stringify(summary, null, 2));
	await app.close();
});
