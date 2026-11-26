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
		await advance.getByRole("button", { name: "Whole season" }).click();
		const progress = appWindow.getByRole("progressbar", {
			name: "Season progress",
		});
		await expect(progress).toBeVisible();
		const values: number[] = [];
		await expect
			.poll(
				async () => {
					values.push(Number(await progress.getAttribute("aria-valuenow")));
					return new Set(values).size;
				},
				{ timeout: 30_000, intervals: [50] },
			)
			.toBeGreaterThanOrEqual(3);
		expect([...values].sort((a, b) => a - b)).toEqual(values);

		// While days are played, a frame still answers quickly. The season of this
		// content lasts about a second on a busy runner, so the frame is measured
		// and Stop pressed in one step, before the season can end by itself.
		const frame = await advance.getByRole("button", { name: "Stop" }).evaluate(
			(stop) =>
				new Promise<number>((resolve) => {
					const start = performance.now();
					requestAnimationFrame(() => {
						resolve(performance.now() - start);
						(stop as HTMLElement).click();
					});
				}),
		);
		expect(frame).toBeLessThan(250);
		await expect(progress).toBeHidden({ timeout: 30_000 });
		await expect(
			advance.getByRole("button", { name: "Play day" }),
		).toBeEnabled();
	});
}
