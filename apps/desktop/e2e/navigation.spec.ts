import { expect, test } from "./fixtures";

test("T5: a blocked navigation preserves the running document", async ({
	electronApp,
	appWindow,
}) => {
	await expect(appWindow.getByRole("main")).toBeAttached();
	const original = await appWindow.evaluateHandle(() => document);
	const observation = await electronApp.evaluateHandle(({ BrowserWindow }) => {
		const window = BrowserWindow.getAllWindows()[0];
		if (!window) throw new Error("No window");
		const contents = window.webContents;
		const attempt = new Promise<boolean>((resolve) => {
			contents.once("will-navigate", (event) =>
				resolve(event.defaultPrevented),
			);
		});
		return { attempt };
	});
	await appWindow.evaluate(() => location.assign("?navigation-test"));
	expect(await observation.evaluate(({ attempt }) => attempt)).toBe(true);
	expect(await original.evaluate((previous) => previous === document)).toBe(
		true,
	);
});

test("T5: a popup cannot create a second BrowserWindow", async ({
	electronApp,
	appWindow,
}) => {
	expect(
		await appWindow.evaluate(() => window.open("about:blank") === null),
	).toBe(true);
	expect(
		await electronApp.evaluate(
			({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
		),
	).toBe(1);
});
