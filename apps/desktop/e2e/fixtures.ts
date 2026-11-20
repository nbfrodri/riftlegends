import {
	test as base,
	type ElectronApplication,
	type Page,
	type PlaywrightWorkerArgs,
} from "@playwright/test";

export { expect } from "@playwright/test";

// Chromium's --lang sets app.getLocale() on every platform, so the UI
// language does not depend on the machine running the tests.
export function launchApp(
	{ playwright }: Pick<PlaywrightWorkerArgs, "playwright">,
	options: {
		profileDir: string;
		systemLocale: string;
		env?: Record<string, string>;
	},
): Promise<ElectronApplication> {
	return playwright._electron.launch({
		args: [
			".",
			`--user-data-dir=${options.profileDir}`,
			`--lang=${options.systemLocale}`,
		],
		chromiumSandbox: true,
		...(options.env && {
			env: {
				...(Object.fromEntries(
					Object.entries(process.env).filter(
						([, value]) => value !== undefined,
					),
				) as Record<string, string>),
				...options.env,
			},
		}),
	});
}

export const test = base.extend<{
	systemLocale: string;
	electronApp: ElectronApplication;
	appWindow: Page;
}>({
	systemLocale: ["en-US", { option: true }],
	electronApp: async ({ playwright, systemLocale }, use, testInfo) => {
		const app = await launchApp(
			{ playwright },
			{ profileDir: testInfo.outputPath("profile"), systemLocale },
		);
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
