import { expect, test } from "./fixtures";

// Plan 31, E3: «Toda la temporada» never freezes the window. The core plays in
// the utility process and the renderer asks for one day at a time.

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`the whole season advances day by day while the window responds at ${width}x${height}`, async ({
		appWindow,
	}) => {
		await appWindow.setViewportSize({ width, height });
		await appWindow
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Competition" })
			.click();
		const cards = appWindow.getByRole("list", { name: "Competitions" });
		await expect(
			cards.getByRole("heading", { name: "Rift League" }),
		).toBeVisible();
		// The page fits the window: only the card grid could scroll.
		expect(
			await appWindow
				.getByRole("main")
				.evaluate(
					(el) =>
						el.scrollWidth === el.clientWidth &&
						el.scrollHeight === el.clientHeight,
				),
		).toBe(true);

		const advance = appWindow.getByRole("group", { name: "Advance" });
		const progress = appWindow.getByRole("progressbar", {
			name: "Season progress",
		});
		const playDay = advance.getByRole("button", { name: "Play day" });
		const stop = advance.getByRole("button", { name: "Stop" });
		const over = appWindow.getByText("Season over");

		// Stop is pressed in the same step as the first change of the progress, so
		// the season cannot end first: it stops early and the controls come back.
		await advance.getByRole("button", { name: "Whole season" }).click();
		await expect(progress).toBeVisible();
		await progress.evaluate(
			(bar) =>
				new Promise<void>((resolve) => {
					const first = bar.getAttribute("aria-valuenow");
					const watch = new MutationObserver(() => {
						if (bar.getAttribute("aria-valuenow") === first) return;
						watch.disconnect();
						document
							.querySelector<HTMLElement>('[aria-label="Advance"] button')
							?.click();
						resolve();
					});
					watch.observe(bar, { attributes: true });
				}),
		);
		await expect(progress).toBeHidden({ timeout: 30_000 });
		await expect(playDay).toBeEnabled();
		await expect(over).toHaveCount(0);

		// Played again, the progress rises strictly and a frame still answers. The
		// values are read inside the page, so the run may end by itself.
		await advance.getByRole("button", { name: "Whole season" }).click();
		await expect(progress).toBeVisible();
		const { values, frame } = await progress.evaluate(
			(bar) =>
				new Promise<{ values: number[]; frame: number }>((resolve) => {
					const values = [Number(bar.getAttribute("aria-valuenow"))];
					let frame = 0;
					const start = performance.now();
					requestAnimationFrame(() => {
						frame = performance.now() - start;
					});
					const done = () => {
						watch.disconnect();
						resolve({ values, frame });
					};
					const watch = new MutationObserver(() => {
						if (!bar.isConnected) return done();
						values.push(Number(bar.getAttribute("aria-valuenow")));
						if (new Set(values).size >= 3 && frame > 0) {
							document
								.querySelector<HTMLElement>('[aria-label="Advance"] button')
								?.click();
							done();
						}
					});
					watch.observe(bar, { attributes: true });
					watch.observe(bar.parentElement ?? document.body, {
						childList: true,
					});
				}),
		);
		expect(new Set(values).size).toBeGreaterThanOrEqual(3);
		expect([...values].sort((a, b) => a - b)).toEqual(values);
		expect(frame).toBeLessThan(250);
		await expect(progress).toBeHidden({ timeout: 30_000 });
		// The run ended by Stop (controls back) or because the season is over.
		await expect(stop).toHaveCount(0);
		if (await over.count()) await expect(playDay).toBeDisabled();
		else await expect(playDay).toBeEnabled();
	});
}
