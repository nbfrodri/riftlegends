import { defineConfig } from "@playwright/test";

// Functional E2E. The screenshot tests live in e2e/visual and run through
// playwright.visual.config.ts (`pnpm e2e:visual`), which only works on Linux.
export default defineConfig({
	testDir: "e2e",
	testIgnore: "visual/**",
});
