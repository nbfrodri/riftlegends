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

test("exposes only ping and the five window controls", async ({
	appWindow,
}) => {
	expect(
		await appWindow.evaluate(() => Object.keys(window.riftlegends).sort()),
	).toEqual(["ping", "window"]);
	expect(
		await appWindow.evaluate(() =>
			Object.keys(window.riftlegends.window).sort(),
		),
	).toEqual([
		"close",
		"isMaximized",
		"minimize",
		"onMaximizedChange",
		"toggleMaximize",
	]);
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

test("shows the title bar with the bundled game icon before the title", async ({
	appWindow,
}) => {
	const bar = appWindow.getByRole("banner");
	const icon = bar.locator("img");
	await expect(bar).toBeVisible();
	await expect(bar).toHaveCSS("height", "32px");
	await expect(bar).toHaveCSS("app-region", "drag");
	await expect(bar.getByText("Rift Legends")).toBeVisible();
	await expect(icon).toBeVisible();
	expect(
		await icon.evaluate((img: HTMLImageElement) => img.naturalWidth),
	).toBeGreaterThan(0);
	const [iconBox, titleBox] = await Promise.all([
		icon.boundingBox(),
		bar.getByText("Rift Legends").boundingBox(),
	]);
	expect(iconBox?.height).toBeCloseTo(16, 0);
	expect(iconBox?.x).toBeLessThan(titleBox?.x ?? 0);
	for (const name of [/^minimize$/i, /^(maximize|restore)$/i, /^close$/i]) {
		await expect(bar.getByRole("button", { name })).toHaveCSS(
			"app-region",
			"no-drag",
		);
	}
});

test("maximizes and restores the native window from the title bar", async ({
	appWindow,
}) => {
	const toggle = appWindow.getByRole("button", {
		name: /^(maximize|restore)$/i,
	});
	const isMaximized = () =>
		appWindow.evaluate(() => window.riftlegends.window.isMaximized());
	// Tiling window managers may maximize the window right after it opens, so
	// start from whatever state it settles into instead of assuming "restored".
	let initial = await isMaximized();
	await expect
		.poll(async () => {
			await appWindow.waitForTimeout(700);
			const current = await isMaximized();
			const stable = current === initial;
			initial = current;
			return stable;
		})
		.toBe(true);
	const label = (maximized: boolean) => (maximized ? "Restore" : "Maximize");

	await expect(toggle).toHaveAccessibleName(label(initial));
	await toggle.click();
	const followed = await expect
		.poll(isMaximized)
		.toBe(!initial)
		.then(
			() => true,
			() => false,
		);
	// A tiling window manager can refuse to restore a window it keeps maximized.
	test.skip(
		initial && !followed,
		"the window manager keeps the window maximized",
	);
	expect(followed).toBe(true);
	await expect(toggle).toHaveAccessibleName(label(!initial));
	await toggle.click();
	await expect.poll(isMaximized).toBe(initial);
	await expect(toggle).toHaveAccessibleName(label(initial));
});
