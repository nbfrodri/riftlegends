import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pacing } from "../src/renderer/draft/pacing.ts";
import { session } from "./session.mjs";
import { traceConfirmation } from "./trace.mjs";

const label = process.argv[2];
const match = /^(power-saver|balanced)(?:-[a-z0-9]+)*$/.exec(label ?? "");
assert.ok(
	match,
	"Usage: pnpm spike:t1 power-saver|balanced (optional suffix, e.g. balanced-t3)",
);
const profile = match[1];
const profileLog = [];
function checkProfile(checkpoint) {
	const observed = execFileSync("powerprofilesctl", ["get"], {
		encoding: "utf8",
	}).trim();
	profileLog.push({ checkpoint, observed, time: new Date().toISOString() });
	assert.equal(observed, profile, `Unexpected energy profile at ${checkpoint}`);
}
checkProfile("start");
const output = mkdtempSync(join(tmpdir(), `rift-s1-t1-${label}-`));
const evidence = new URL(
	"../../../docs/research/spikes-2026-11/",
	import.meta.url,
);
console.log("T1:", output);
const runs = [];
const rows = [
	"run,confirmation,input_ms,first_changed_raf_ms,following_raf_ms,latency_ms",
];
const frames = ["run,confirmation,previous_raf_ms,raf_ms,interval_ms,phase"];

const action = (page, name) => page.getByRole("button", { name, exact: true });
const ban = (page) => action(page, "Vetar a Nimbo").click();
const confirm = (page) => action(page, "Confirmar elección").click();
const reset = (page) => action(page, "Repetir turno").click();

// Playwright serializes this function into the renderer. Keep its state local.
function observeConfirmation(pacing) {
	const button = document.querySelector(".hero-caption button");
	const pick = document.querySelector(".current-pick strong");
	const caption = document.querySelector(".hero-caption small");
	let input = null;
	let first = null;
	let following = null;
	let previous = null;
	const frames = [];
	const labelEnd = pacing.labelDelayMs + pacing.labelEnterMs;
	const endOfMotion = Math.max(pacing.sweepMs, labelEnd);
	const { promise, resolve, reject } = Promise.withResolvers();
	window.t1Result = promise;
	const timeout = setTimeout(
		() => reject(new Error("Missing visible confirmation")),
		3500,
	);
	button.addEventListener(
		"pointerdown",
		(event) => {
			input = event.timeStamp;
		},
		{ once: true },
	);

	function recordInterval(stamp) {
		if (previous === null || stamp <= input) return;
		const start = previous - input;
		const inSweep = start < pacing.sweepMs;
		const inLabel = stamp - input >= pacing.labelDelayMs && start < labelEnd;
		if (inSweep || inLabel)
			frames.push([
				previous,
				stamp,
				stamp - previous,
				inSweep ? "sweep" : "label",
			]);
	}

	function frame(stamp) {
		if (input !== null) {
			if (first !== null && following === null) following = performance.now();
			if (
				first === null &&
				pick.textContent === "Veyra" &&
				caption.textContent === "Elección confirmada"
			)
				first = performance.now();
			recordInterval(stamp);
			if (following !== null && stamp - input >= endOfMotion) {
				clearTimeout(timeout);
				resolve({ input, first, following, frames });
				return;
			}
		}
		previous = stamp;
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

async function sample(page) {
	await ban(page);
	await page.evaluate(observeConfirmation, pacing);
	await confirm(page);
	const result = await page.evaluate(() => window.t1Result);
	assert.ok(result.frames.length > 0);
	await reset(page);
	return result;
}

const p95 = (values) =>
	values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
function metrics(samples) {
	const latency = samples.map((s) => s.following - s.input);
	const intervals = samples.flatMap((s) => s.frames.map((f) => f[2]));
	return {
		confirmations: latency.length,
		latencyP95: p95(latency),
		latencyMax: Math.max(...latency),
		fps: (1000 * intervals.length) / intervals.reduce((a, b) => a + b, 0),
		intervalP95: p95(intervals),
		intervalMax: Math.max(...intervals),
		intervals: intervals.length,
	};
}

async function visuals(page, hardware) {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.screencast.start({
		path: join(output, "s1-before.webm"),
		size: { width: 1280, height: 720 },
		fps: 60,
	});
	await wait(400);
	await ban(page);
	await page.waitForFunction(
		() => document.querySelector(".turn-clock time").textContent === "00:07",
	);
	await confirm(page);
	await wait(900);
	await page.screencast.stop();
	await page.screenshot({
		path: join(output, "s1-1280x720.png"),
		scale: "css",
	});
	const layout = await page.evaluate(() => {
		const box = (el) => {
			const { x, y, width, height } = el.getBoundingClientRect();
			return { x, y, width, height };
		};
		const board = document.querySelector(".broadcast-board");
		const outOfView = [...board.querySelectorAll("li,small,h2,s,strong,button")]
			.filter((el) => {
				const { x, y, width, height } = box(el);
				return (
					x < 0 ||
					y < 0 ||
					x + width > innerWidth + 1 ||
					y + height > innerHeight + 1
				);
			})
			.map((el) => el.textContent);
		return {
			columns: getComputedStyle(board).gridTemplateColumns,
			outOfView,
			displayFont: document.fonts.check('700 42px "Unbounded Variable"'),
			bodyFont: document.fonts.check('700 31px "Archivo Variable"'),
		};
	});
	assert.deepEqual(layout.outOfView, []);
	assert.ok(layout.displayFont && layout.bodyFont);
	await reset(page);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await ban(page);
	await page.evaluate(() => {
		document.querySelector(".hero-caption button").addEventListener(
			"click",
			() => {
				window.reducedFrame = new Promise((resolve) =>
					requestAnimationFrame(() => {
						const label = document.querySelector('[role="status"] strong');
						resolve({
							text: label?.textContent,
							opacity: label && getComputedStyle(label).opacity,
							animations: label?.getAnimations().length,
							hiddenSweep: document.querySelector("canvas").hidden,
							focused:
								document.activeElement ===
								document.querySelector(".hero-caption button"),
						});
					}),
				);
			},
			{ once: true },
		);
	});
	await page.keyboard.press("Enter");
	const reduced = await page.evaluate(() => window.reducedFrame);
	assert.deepEqual(reduced, {
		text: "B4 confirmado · Veyra",
		opacity: "1",
		animations: 0,
		hiddenSweep: true,
		focused: true,
	});
	return { hardware, layout, reduced };
}

for (let run = 1; run <= 3; run++) {
	checkProfile(`start-run-${run}`);
	const samples = await session(output, 1366, 768, async (page, hardware) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		for (let i = 0; i < 5; i++) await sample(page);
		const samples = [];
		for (let i = 1; i <= 20; i++) {
			const s = await sample(page);
			rows.push(
				[run, i, s.input, s.first, s.following, s.following - s.input].join(
					",",
				),
			);
			for (const f of s.frames) frames.push([run, i, ...f].join(","));
			samples.push(s);
		}
		await ban(page);
		const exercise = async () => {
			await confirm(page);
			await wait(700);
		};
		if (run === 1)
			await traceConfirmation(
				page,
				join(output, "s1-chromium.json.gz"),
				exercise,
			);
		else await exercise();
		await page.screenshot({
			path: join(output, `s1-run-${run}.png`),
			scale: "css",
		});
		writeFileSync(
			join(output, `s1-host-${run}.json`),
			JSON.stringify(hardware, null, 2),
		);
		return samples;
	});
	runs.push(samples);
	checkProfile(`end-run-${run}`);
	console.log("run", run, metrics(samples));
	writeFileSync(join(output, "s1-confirmations.csv"), `${rows.join("\n")}\n`);
	writeFileSync(join(output, "s1-frames.csv"), `${frames.join("\n")}\n`);
}
const checks = await session(output, 1280, 720, visuals);
checkProfile("end-visuals");
const summary = {
	label,
	profileLog,
	commit: execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim(),
	runs: runs.map(metrics),
	total: metrics(runs.flat()),
	checks,
};
writeFileSync(
	join(output, "s1-results.json"),
	`${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 2));
mkdirSync(evidence, { recursive: true });
for (const [source, suffix] of [
	["s1-confirmations.csv", ".csv"],
	["s1-frames.csv", "-frames.csv"],
	["s1-results.json", ".json"],
	["s1-before.webm", "-before.webm"],
	["s1-chromium.json.gz", "-chromium.json.gz"],
	["s1-1280x720.png", "-1280x720.png"],
	["s1-run-1.png", "-1366x768.png"],
])
	copyFileSync(
		join(output, source),
		new URL(`s1-t1-${label}${suffix}`, evidence),
	);
const pass = (m) => m.latencyP95 <= 100 && m.fps >= 55 && m.intervalP95 <= 25;
if (!summary.runs.every(pass) || !pass(summary.total)) process.exitCode = 1;
