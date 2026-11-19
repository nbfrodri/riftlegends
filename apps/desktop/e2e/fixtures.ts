import {
	test as base,
	type ElectronApplication,
	type Page,
} from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend<{
	systemLocale: string;
	electronApp: ElectronApplication;
	appWindow: Page;
}>({
	// Chromium's --lang sets app.getLocale() on every platform, so the UI
	// language does not depend on the machine running the tests.
	systemLocale: ["en-US", { option: true }],
	electronApp: async ({ playwright, systemLocale }, use, testInfo) => {
		const app = await playwright._electron.launch({
			args: [
				".",
				`--user-data-dir=${testInfo.outputPath("profile")}`,
				`--lang=${systemLocale}`,
			],
			chromiumSandbox: true,
		});
		try {
			await use(app);
		} finally {
			await app.close();
		}
	},
	appWindow: async ({ electronApp }, use) => {
		await use(await electronApp.firstWindow());
	},
});
