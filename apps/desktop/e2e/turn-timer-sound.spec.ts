import { COUNTDOWN_SECONDS } from "../src/renderer/sound/countdown-ticks";
import { expect, test } from "./fixtures";
import { seedNextSeries } from "./quick-draft-flow";

declare global {
	interface Window {
		startedSounds: number;
	}
}

test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

// #505: with the turn timer on, my turn ticks once per second over its last
// 10 seconds. The spy counts the tick marks the sound player leaves; the page clock
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
	// Count only the tick: the player marks `sound:<id>` on every start, and
	// the AI's ban and pick sounds must not count.
	await page.evaluate(() => {
		window.startedSounds = 0;
		const mark = performance.mark.bind(performance);
		performance.mark = (name, options) => {
			if (name === "sound:tick") window.startedSounds++;
			return mark(name, options);
		};
	});
	const started = () => page.evaluate(() => window.startedSounds);

	// The page clock keeps running in real time, so keep clear of the edges.
	await page.clock.runFor(15_000);
	expect(await started()).toBe(0);
	// Real time keeps running under the page clock, so only bound the count.
	await page.clock.runFor(7_000);
	expect(await started()).toBeGreaterThanOrEqual(1);
	expect(await started()).toBeLessThanOrEqual(COUNTDOWN_SECONDS);

	await page
		.getByRole("group", { name: "Champions" })
		.getByRole("button", { disabled: false })
		.first()
		.click();
	await page.getByRole("button", { name: /^Confirm (ban|pick)$/ }).click();
	// The old turn still had ticks left (22 s of 30 s), so any that survive the
	// confirm fire within seconds; my next turn is 20 s from ticking.
	const after = await started();
	await page.clock.runFor(6_000);
	expect(await started()).toBe(after);
});
