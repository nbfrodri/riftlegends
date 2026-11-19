import { test as base, expect, type Page } from "@playwright/test";

const test = base.extend<{ appWindow: Page }>({
	appWindow: async ({ playwright }, use, testInfo) => {
		const app = await playwright._electron.launch({
			args: [".", `--user-data-dir=${testInfo.outputPath("profile")}`],
			chromiumSandbox: true,
		});
		try {
			await use(await app.firstWindow());
		} finally {
			await app.close();
		}
	},
});

test("opens the Rift Legends window", async ({ appWindow }) => {
	await expect(appWindow).toHaveTitle("Rift Legends");
	await expect(appWindow.getByRole("main")).toBeAttached();
});

test("keeps Node globals out of the renderer", async ({ appWindow }) => {
	expect(
		await appWindow.evaluate(() => [
			typeof require,
			typeof process,
			typeof module,
		]),
	).toEqual(["undefined", "undefined", "undefined"]);
});

test("exposes only ping and receives pong from main", async ({ appWindow }) => {
	expect(
		await appWindow.evaluate(() => Object.keys(window.riftlegends)),
	).toEqual(["ping"]);
	expect(await appWindow.evaluate(() => window.riftlegends.ping())).toBe(
		"pong",
	);
});
