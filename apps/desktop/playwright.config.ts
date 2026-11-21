import { defineConfig } from "@playwright/test";

// Functional E2E. The screenshot tests live in e2e/visual and run through
// playwright.visual.config.ts (`pnpm e2e:visual`), which only works on Linux.
export default defineConfig({
	testDir: "e2e",
	testIgnore: "visual/**",
	// Measure S1 on an idle display after the other Electron windows close.
	projects: [
		{
			name: "functional",
			testIgnore: ["visual/**", "**/draft-broadcast.spec.ts"],
		},
		{
			name: "broadcast",
			testMatch: "**/draft-broadcast.spec.ts",
			dependencies: ["functional"],
		},
	],
});
