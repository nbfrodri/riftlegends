import { expect, test } from "./fixtures";
import { waitForCaptureAssets } from "./visual/capture";

test("opens the Rift Legends window", async ({ appWindow }) => {
	await expect(appWindow).toHaveTitle("Rift Legends");
	await expect(appWindow.getByRole("main")).toBeAttached();
});

test("preserves the exact CSP in the distributed renderer", async ({
	appWindow,
}) => {
	await expect(
		appWindow.locator('meta[http-equiv="Content-Security-Policy"]'),
	).toHaveAttribute(
		"content",
		"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' rl-asset: rift-asset:; base-uri 'none'; form-action 'none'",
	);
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

test("exposes only ping, the system locale, the window controls, assets and the core", async ({
	appWindow,
}) => {
	expect(
		await appWindow.evaluate(() => Object.keys(window.riftlegends).sort()),
	).toEqual(["assets", "core", "ping", "systemLocale", "window"]);
	expect(
		await appWindow.evaluate(() => Object.keys(window.riftlegends.core).sort()),
	).toEqual(["open", "query", "send", "subscribe"]);
	expect(
		await appWindow.evaluate(() =>
			Object.keys(window.riftlegends.assets).sort(),
		),
	).toEqual([
		"champions",
		"leagueLogos",
		"playerPhotos",
		"status",
		"subscribe",
		"subscribePlayerPhotos",
		"subscribeTeamLogos",
		"sync",
		"teamLogos",
	]);
	expect(
		await appWindow.evaluate(() => window.riftlegends.systemLocale()),
	).toBe("en-US");
	expect(
		await appWindow.evaluate(() =>
			Object.keys(window.riftlegends.window).sort(),
		),
	).toEqual([
		"canMinimize",
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
	await expect(appWindow.getByRole("main")).toBeAttached();
	await waitForCaptureAssets(appWindow);
	const loaded = await appWindow.evaluate(() => {
		return [...document.fonts]
			.filter((face) => face.status === "loaded")
			.map((face) => face.family.replaceAll('"', ""));
	});
	expect(loaded).toEqual(
		expect.arrayContaining(["Unbounded Variable", "Archivo Variable"]),
	);
	expect(requests.filter((url) => !/^(file:|rl-asset:)/.test(url))).toEqual([]);
});

test("visual readiness rejects missing Caja fonts even when the font set is ready", async ({
	appWindow,
}) => {
	await expect(appWindow.getByRole("main")).toBeAttached();
	await appWindow.evaluate(async () => {
		for (const stylesheet of document.querySelectorAll(
			'link[rel="stylesheet"]',
		)) {
			stylesheet.remove();
		}
		await document.fonts.ready;
	});

	await expect(waitForCaptureAssets(appWindow)).rejects.toThrow(
		/Caja font is unavailable/,
	);
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
	// Minimize is hidden on tiling Wayland compositors, so check every button shown.
	const buttons = await bar.getByRole("button").all();
	expect(buttons.length).toBeGreaterThanOrEqual(2);
	for (const button of buttons) {
		await expect(button).toHaveCSS("app-region", "no-drag");
	}
});

test("title bar asks the main process to maximize and restore", async ({
	electronApp,
	appWindow,
}) => {
	// Replace the native calls with a recorder so the test checks our wiring
	// (button -> IPC -> main -> state event -> label) and not the window manager,
	// which Xvfb in CI does not have and tiling managers override.
	await electronApp.evaluate(({ BrowserWindow }) => {
		const window = BrowserWindow.getAllWindows()[0];
		if (!window) throw new Error("No window");
		let maximized = false;
		const calls: string[] = [];
		Object.assign(globalThis, { windowControlCalls: calls });
		window.isMaximized = () => maximized;
		window.maximize = () => {
			calls.push("maximize");
			maximized = true;
			window.emit("maximize");
		};
		window.unmaximize = () => {
			calls.push("unmaximize");
			maximized = false;
			window.emit("unmaximize");
		};
	});
	const toggle = appWindow.getByRole("button", {
		name: /^(maximize|restore)$/i,
	});
	const calls = () =>
		electronApp.evaluate(
			() =>
				(globalThis as { windowControlCalls?: string[] }).windowControlCalls,
		);

	await toggle.click();
	await expect.poll(calls).toEqual(["maximize"]);
	await expect(toggle).toHaveAccessibleName("Restore");
	await toggle.click();
	await expect.poll(calls).toEqual(["maximize", "unmaximize"]);
	await expect(toggle).toHaveAccessibleName("Maximize");
});

test("maximizes and restores the native window on Windows", async ({
	appWindow,
}) => {
	test.skip(
		process.platform !== "win32",
		"only Windows CI has a real window manager; Xvfb and tiling managers do not honour it",
	);
	const toggle = appWindow.getByRole("button", {
		name: /^(maximize|restore)$/i,
	});
	const isMaximized = () =>
		appWindow.evaluate(() => window.riftlegends.window.isMaximized());
	const initial = await isMaximized();
	await toggle.click();
	await expect.poll(isMaximized).toBe(!initial);
	await toggle.click();
	await expect.poll(isMaximized).toBe(initial);
});
