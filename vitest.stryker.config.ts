import { defineConfig } from "vitest/config";

// Used only by Stryker: runs the `core` tests alone. Instrumented code is slower, so
// the heavy statistical tests need a longer per-test timeout than in `vitest.config.ts`.
export default defineConfig({
	test: {
		name: "core",
		include: [
			"packages/core/**/*.test.ts",
			// The competition engine (season, tournament, views) is exercised through the host dispatcher, so
			// its behavioural tests live in the desktop core-host. Without them every competition mutant is
			// reported as having no coverage.
			"apps/desktop/src/core-host/season*.test.ts",
			"apps/desktop/src/core-host/tournament.test.ts",
		],
		exclude: [
			// Monte Carlo calibration (K bands) replays thousands of games per test: under instrumentation each
			// mutant would take minutes. The sources are excluded from `mutate` in stryker.config.json and the
			// tests keep running in `pnpm test`.
			"packages/core/match/calibration/**",
			"packages/core/calibration/**",
			// F13 and K4 are Monte Carlo bands too, with their own 15 s limit.
			"packages/core/match/risk.test.ts",
			// Benchmark, not a behaviour test.
			"**/*.bench.test.ts",
		],
		testTimeout: 60_000,
	},
});
