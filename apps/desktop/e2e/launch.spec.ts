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

test("T3: loads both bundled Caja fonts while offline", async ({
	appWindow,
}) => {
	const context = appWindow.context();
	const requests: string[] = [];
	context.on("request", (request) => requests.push(request.url()));
	await context.setOffline(true);
	await appWindow.reload();
	const loaded = await appWindow.evaluate(async () => {
		await Promise.all(Array.from(document.fonts, (face) => face.load()));
		return Promise.all(
			['700 24px "Unbounded Variable"', '400 16px "Archivo Variable"'].map(
				async (font) => {
					const faces = await document.fonts.load(font, "Ajustes 0123");
					return (
						faces.length > 0 &&
						faces.every((face) => face.status === "loaded") &&
						document.fonts.check(font)
					);
				},
			),
		);
	});
	expect(loaded).toEqual([true, true]);
	expect(requests.filter((url) => !/^(file:|rl-asset:)/.test(url))).toEqual([]);
});
