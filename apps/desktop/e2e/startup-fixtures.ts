import { mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, launchApp } from "./fixtures";

/** Hold the real cache writer lock until the test has observed the loading screen. */
export const test = base.extend<{
	startup: { page: Page; profile: string; release(): Promise<void> };
}>({
	startup: async ({ playwright, systemLocale }, use, info) => {
		const profile = info.outputPath("startup-profile");
		const lock = join(
			profile,
			"assets",
			`sync-${process.pid}-00000000-0000-4000-8000-000000000000`,
		);
		await mkdir(lock, { recursive: true });
		const app = await launchApp(
			{ playwright },
			{ profileDir: profile, systemLocale, env: { RIFT_E2E_CONTENT: "real" } },
		);
		try {
			await use({
				page: await app.firstWindow(),
				profile,
				release: () => rmdir(lock),
			});
		} finally {
			await app.close();
		}
	},
});
