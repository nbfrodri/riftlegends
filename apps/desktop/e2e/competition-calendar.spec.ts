import { expect, test } from "./fixtures";

// #593: the calendar in its three views fits the window without page scroll,
// from the sidebar «Calendar» section and from a competition's tab.

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`the calendar views fit the window at ${width}x${height}`, async ({
		appWindow,
	}) => {
		await appWindow.setViewportSize({ width, height });
		const nav = appWindow.getByRole("navigation", { name: "Club sections" });
		const main = appWindow.getByRole("main");
		const fits = () =>
			main.evaluate(
				(el) =>
					el.scrollWidth === el.clientWidth &&
					el.scrollHeight === el.clientHeight,
			);
		const grid = appWindow.getByRole("grid");
		const title = appWindow.getByRole("heading", { level: 2 });

		await nav.getByRole("button", { name: "Calendar" }).click();
		await expect(
			appWindow.getByRole("heading", { level: 1, name: "Calendar" }),
		).toBeVisible();
		await expect(grid).toBeVisible({ timeout: 30_000 });
		await expect(grid.locator('[aria-current="date"]')).toBeVisible();
		expect(await fits()).toBe(true);

		await appWindow
			.getByRole("radio", { name: "Month" })
			.check({ force: true });
		await expect(grid.getByRole("row")).not.toHaveCount(0);
		expect(await fits()).toBe(true);
		// Every day of the month is on screen, not only through the panel's scroll.
		const box = await grid.boundingBox();
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);

		await appWindow.getByRole("radio", { name: "Day" }).check({ force: true });
		await expect(appWindow.getByRole("list", { name: /\d{4}/ })).toBeVisible();
		expect(await fits()).toBe(true);
		const before = await title.textContent();
		await appWindow.getByRole("button", { name: "Next" }).click();
		await expect(title).not.toHaveText(before ?? "");

		// The competition's tab uses the same calendar with its filters.
		await nav.getByRole("button", { name: "Competition" }).click();
		await appWindow.getByRole("button", { name: "Open Rift League" }).click();
		await appWindow
			.getByRole("radio", { name: "Schedule" })
			.check({ force: true });
		await expect(grid).toBeVisible();
		await expect(
			appWindow.getByRole("combobox", { name: "Team" }),
		).toBeVisible();
		expect(await fits()).toBe(true);
		await appWindow
			.getByRole("radio", { name: "Month" })
			.check({ force: true });
		expect(await fits()).toBe(true);
	});
}
