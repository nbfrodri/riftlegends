import { defineConfig } from "@playwright/test";

// SPIKE S2 (#74), THROW-AWAY.
export default defineConfig({
	testDir: ".",
	testMatch: "s2-*.spec.ts",
	workers: 1,
	reporter: "list",
});
