import { defineConfig } from "vitest/config";

// Used only by Stryker: runs the `core` tests alone. Instrumented code is slower, so
// the heavy statistical tests need a longer per-test timeout than in `vitest.config.ts`.
export default defineConfig({
	test: {
		name: "core",
		include: ["packages/core/**/*.test.ts"],
		testTimeout: 60_000,
	},
});
