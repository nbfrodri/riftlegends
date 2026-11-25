import { expect, test } from "./fixtures";

declare global {
	interface Window {
		startedSounds: number;
	}
}

// #472: offline there is no cache, so the draft plays its own sounds. The spy
// counts the buffers Web Audio starts and reads the player's marks.
test("confirming a pick plays the lock sound", async ({
	electronApp,
	appWindow: page,
}) => {
	await electronApp.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0]?.focus(),
	);
	await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
	await page.evaluate(() => {
		window.startedSounds = 0;
		const start = AudioBufferSourceNode.prototype.start;
		AudioBufferSourceNode.prototype.start = function (...args) {
			window.startedSounds++;
			return start.apply(this, args);
		};
	});

	await page.getByRole("button", { name: "Draft", exact: true }).click();
	await page.getByRole("combobox", { name: "My team" }).click();
	await page.getByRole("option", { name: "Shoal" }).click();
	await page.getByRole("button", { name: "Start series" }).click();
	await page.getByRole("button", { name: "Confirm choice" }).click();
	await page.getByRole("button", { name: "Go to draft" }).click();

	const grid = page.getByRole("group", { name: "Champions" });
	const confirm = page.getByRole("button", { name: /^Confirm (ban|pick)$/ });
	for (;;) {
		await expect(
			page.getByRole("heading", { name: "Choose a champion" }),
		).toBeVisible();
		await grid.getByRole("button", { disabled: false }).first().click();
		if ((await confirm.textContent())?.includes("pick")) break;
		await confirm.click();
	}

	const before = await page.evaluate(() => {
		performance.clearMarks("sound:lock");
		return window.startedSounds;
	});
	await confirm.click();
	await expect
		.poll(() =>
			page.evaluate(() => performance.getEntriesByName("sound:lock").length),
		)
		.toBe(1);
	expect(await page.evaluate(() => window.startedSounds)).toBeGreaterThan(
		before,
	);
});
