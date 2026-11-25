import { expect, test } from "./fixtures";
import { seedNextSeries } from "./quick-draft-flow";

declare global {
	interface Window {
		startedSounds: number;
	}
}

test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

// #505: with the turn timer on, my turn ticks once per second over its last
// 10 seconds. The spy counts the buffers Web Audio starts; the page clock
// skips the 30 s turn.
test("the last 10 seconds of my turn tick once per second and stop on confirm", async ({
	electronApp,
	appWindow: page,
}) => {
	await electronApp.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0]?.focus(),
	);
	await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
	await seedNextSeries(electronApp, 7);
	await page.getByRole("button", { name: "Draft", exact: true }).click();
	await page
		.getByRole("radio", { name: "On", exact: true })
		.check({ force: true });
	await page.getByRole("button", { name: "Start series" }).click();
	await page.getByRole("button", { name: "Confirm choice" }).click();
	await page.clock.install();
	await page.getByRole("button", { name: "Go to draft" }).click();
	await expect(page.getByRole("timer")).toBeVisible();
	await page.evaluate(() => {
		window.startedSounds = 0;
		const start = AudioBufferSourceNode.prototype.start;
		AudioBufferSourceNode.prototype.start = function (...args) {
			window.startedSounds++;
			return start.apply(this, args);
		};
	});
	const started = () => page.evaluate(() => window.startedSounds);

	// The page clock keeps running in real time, so keep clear of the edges.
	await page.clock.runFor(15_000);
	expect(await started()).toBe(0);
	await page.clock.runFor(7_000);
	expect(await started()).toBeGreaterThanOrEqual(1);
	expect(await started()).toBeLessThanOrEqual(4);

	await page
		.getByRole("group", { name: "Champions" })
		.getByRole("button", { disabled: false })
		.first()
		.click();
	await page.getByRole("button", { name: /^Confirm (ban|pick)$/ }).click();
	// Let the AI answer and my next turn begin: it is 20 s from ticking.
	await page.clock.runFor(2_000);
	const after = await started();
	await page.clock.runFor(15_000);
	expect(await started()).toBe(after);
});
