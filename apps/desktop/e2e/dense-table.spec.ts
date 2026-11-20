import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// T2 (reduced): keyboard navigation of the virtualised Market table. It only
// checks that focus lands on the right row and stays visible; the frame and
// latency budgets were measured in spike S2 and are not asserted here.

const TOTAL = 36;
const COLUMNS = 8;

const table = (page: Page) =>
	page.getByRole("table", { name: "Available players" });
const dataRows = (page: Page) => table(page).locator("tbody tr[data-row-id]");
const rowAt = (page: Page, position: number) =>
	table(page).locator(`tbody tr[data-index="${position}"]`);

// The focused row is entirely inside the scrolling region and below the sticky
// header.
const expectVisible = async (page: Page, row: Locator) => {
	const region = page.getByRole("region", { name: "Available players" });
	const header = table(page).locator("thead");
	await expect
		.poll(async () => {
			const [box, rowBox, headBox] = await Promise.all([
				region.boundingBox(),
				row.boundingBox(),
				header.boundingBox(),
			]);
			if (!box || !rowBox || !headBox) return false;
			return (
				rowBox.y >= headBox.y + headBox.height - 0.5 &&
				rowBox.y + rowBox.height <= box.y + box.height + 0.5
			);
		})
		.toBe(true);
};

test("T2: End and Home move focus to rows that start outside the window", async ({
	appWindow,
}) => {
	await appWindow
		.getByRole("navigation", { name: "Club sections" })
		.getByRole("button", { name: "Market" })
		.click();
	await expect(table(appWindow)).toHaveAttribute(
		"aria-rowcount",
		String(TOTAL + 1),
	);

	// Enter the table with the keyboard: the first row is the tab stop.
	await appWindow.getByRole("searchbox").focus();
	// ...past the scrolling region and the eight sortable headers.
	for (let tab = 0; tab < COLUMNS + 2; tab++) {
		await appWindow.keyboard.press("Tab");
	}
	await expect(rowAt(appWindow, 0)).toBeFocused();

	// The last row is not mounted until the window is asked for it.
	const mounted = await dataRows(appWindow).count();
	expect(mounted).toBeLessThan(TOTAL);
	await expect(rowAt(appWindow, TOTAL - 1)).toHaveCount(0);

	await appWindow.keyboard.press("End");
	await expect(rowAt(appWindow, TOTAL - 1)).toBeFocused();
	await expectVisible(appWindow, rowAt(appWindow, TOTAL - 1));

	await appWindow.keyboard.press("Home");
	await expect(rowAt(appWindow, 0)).toBeFocused();
	await expectVisible(appWindow, rowAt(appWindow, 0));
});

test("T2: the arrow keys walk the whole table and keep the focused row visible", async ({
	appWindow,
}) => {
	await appWindow
		.getByRole("navigation", { name: "Club sections" })
		.getByRole("button", { name: "Market" })
		.click();
	await expect(table(appWindow)).toBeVisible();
	await rowAt(appWindow, 0).focus();

	for (let index = 1; index < TOTAL; index++) {
		await appWindow.keyboard.press("ArrowDown");
		await expect(rowAt(appWindow, index)).toBeFocused();
	}
	await expectVisible(appWindow, rowAt(appWindow, TOTAL - 1));

	for (let index = TOTAL - 2; index >= 0; index--) {
		await appWindow.keyboard.press("ArrowUp");
		await expect(rowAt(appWindow, index)).toBeFocused();
	}
	await expectVisible(appWindow, rowAt(appWindow, 0));
});
