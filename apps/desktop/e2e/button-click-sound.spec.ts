import { expect, test } from "./fixtures";

// #493: offline there is no cache, so buttons play our own synthesized click.
test("a button click plays the click sound, a disabled one does not", async ({
	electronApp,
	appWindow: page,
}) => {
	await electronApp.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0]?.focus(),
	);
	await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
	const clicks = () =>
		page.evaluate(() => performance.getEntriesByName("sound:click").length);
	await page.evaluate(() => performance.clearMarks("sound:click"));

	await page.getByRole("button", { name: "Draft", exact: true }).click();
	await expect.poll(clicks).toBe(1);

	// "Start series" is disabled until a team is chosen.
	await page.evaluate(() => performance.clearMarks("sound:click"));
	await page
		.getByRole("button", { name: "Start series" })
		.click({ force: true });
	expect(await clicks()).toBe(0);
});
