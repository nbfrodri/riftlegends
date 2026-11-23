import { expect, test } from "./fixtures";

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`opens a champion card from the sidebar at ${width}x${height}`, async ({
		appWindow,
	}) => {
		await appWindow.setViewportSize({ width, height });
		await appWindow
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Champions" })
			.click();
		await expect(
			appWindow.getByRole("heading", { name: "Champions" }),
		).toBeVisible();
		const tile = appWindow.getByRole("button", { name: "Cragbell" });
		await expect(
			appWindow.getByRole("heading", { name: "D", exact: true }),
		).toBeInViewport({ ratio: 1 });
		expect(
			await appWindow
				.getByRole("main")
				.evaluate(
					(el) =>
						el.scrollWidth === el.clientWidth &&
						el.scrollHeight === el.clientHeight,
				),
		).toBe(true);
		await tile.click();
		const card = appWindow.getByRole("region", {
			name: "Champion card: Cragbell",
		});
		await expect(
			card.getByRole("heading", { name: "Synergies" }),
		).toBeVisible();
		await expect(card).toBeInViewport({ ratio: 1 });
		await card.getByRole("button", { name: "Close champion card" }).click();
		await expect(tile).toBeFocused();
	});
}
