import { expect, test } from "./fixtures";

// Plan 31, U3: the standings of a competition fit the window, without page
// scroll, at the minimum and the default size.

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`the standings of a league fit the window at ${width}x${height}`, async ({
		appWindow,
	}) => {
		await appWindow.setViewportSize({ width, height });
		await appWindow
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Competition" })
			.click();
		await appWindow
			.getByRole("list", { name: "Competitions" })
			.getByRole("button", { name: /Rift League/ })
			.click();
		const table = appWindow.getByRole("table", {
			name: "Standings: Regular",
		});
		await expect(table).toBeVisible();
		await expect(table.getByRole("row")).toHaveCount(9);
		await expect(
			table.getByRole("columnheader", { name: "Destination" }),
		).toBeVisible();
		expect(
			await appWindow
				.getByRole("main")
				.evaluate(
					(el) =>
						el.scrollWidth === el.clientWidth &&
						el.scrollHeight === el.clientHeight,
				),
		).toBe(true);
	});
}
