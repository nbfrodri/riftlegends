import { defineConfig } from "@playwright/test";

// Visual regression. Baselines are rasterised text, so they are only valid on
// the CI image (ubuntu-latest under Xvfb) and are never generated locally: see
// e2e/visual/README.md. The path has no platform suffix on purpose, because the
// tests skip on every other platform.
export default defineConfig({
	testDir: "e2e/visual",
	snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
	expect: {
		// A cold first capture on CI can take longer than the 5 s default.
		timeout: 15_000,
		toHaveScreenshot: {
			// Tolerates sub-pixel anti-aliasing noise (0.2% of 1366x768 is about
			// 2,100 pixels) but not a moved element or a changed colour.
			maxDiffPixelRatio: 0.002,
			animations: "disabled",
			caret: "hide",
		},
	},
	reporter: [["list"], ["html", { open: "never" }]],
});
