import {
	test as base,
	type ElectronApplication,
	type Page,
	type PlaywrightWorkerArgs,
} from "@playwright/test";

import { withLaunchRetry } from "./launch-retry";

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
	return withLaunchRetry(() =>
		playwright._electron.launch({
			args: [
				".",
				`--user-data-dir=${options.profileDir}`,
				`--lang=${options.systemLocale}`,
			],
			chromiumSandbox: true,
			env: {
				...(Object.fromEntries(
					Object.entries(process.env).filter(
						([, value]) => value !== undefined,
					),
				) as Record<string, string>),
				...options.env,
				RIFT_E2E_OFFLINE: "1",
			},
		}),
	);
}

export const test = base.extend<{
	systemLocale: string;
	appEnv: Record<string, string> | undefined;
	electronApp: ElectronApplication;
	appWindow: Page;
}>({
	systemLocale: ["en-US", { option: true }],
	appEnv: [undefined, { option: true }],
	electronApp: async ({ playwright, systemLocale, appEnv }, use, testInfo) => {
		const app = await launchApp(
			{ playwright },
			{
				profileDir: testInfo.outputPath("profile"),
				systemLocale,
				...(appEnv && { env: appEnv }),
			},
		);
		// Keep a trace (screenshots and DOM snapshots) only when a test fails,
		// to diagnose flaky failures in CI (#116).
		await app.context().tracing.start({ screenshots: true, snapshots: true });
		try {
			await use(app);
		} finally {
			const failed = testInfo.status !== testInfo.expectedStatus;
			await app
				.context()
				.tracing.stop(failed ? { path: testInfo.outputPath("trace.zip") } : {});
			await app.close();
		}
	},
	appWindow: async ({ electronApp }, use) => {
		await use(await electronApp.firstWindow());
	},
});
