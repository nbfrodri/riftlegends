import { cpuUsage } from "node:process";
import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Benchmark of plan 12's budget: an AI-vs-AI year of the real exhibition season
// (six leagues and three international events) in <= 60 s on the user's
// machine (#584). Skipped by default: run it with
//   RIFT_BENCH=1 pnpm exec vitest run --project desktop season-year.bench
// It reports CPU time, which is what stays comparable on a busy machine; set
// RIFT_BENCH_BUDGET_MS to make it fail above a budget.

test.skipIf(!process.env.RIFT_BENCH)(
	"a whole real season plays within the budget",
	() => {
		const before = cpuUsage();
		const started = performance.now();
		const dayMs: number[] = [];
		const { played } = replayDigest(realSeason(9), undefined, (ms) =>
			dayMs.push(ms),
		);
		dayMs.sort((a, b) => a - b);
		const cpu = cpuUsage(before);
		const cpuMs = Math.round((cpu.user + cpu.system) / 1000);
		console.log(
			`season year: ${played} days, ${cpuMs} ms CPU, ${Math.round(performance.now() - started)} ms wall; per day median ${Math.round(dayMs[dayMs.length >> 1] ?? 0)} ms, worst ${Math.round(dayMs.at(-1) ?? 0)} ms`,
		);
		expect(played).toBeGreaterThan(100);
		const budget = Number(process.env.RIFT_BENCH_BUDGET_MS);
		if (budget) expect(cpuMs).toBeLessThan(budget);
	},
	3_600_000,
);
