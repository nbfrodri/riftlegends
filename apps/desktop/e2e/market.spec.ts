import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const openMarket = async (page: Page) => {
	await page
		.getByRole("navigation", { name: "Club sections" })
		.getByRole("button", { name: "Market" })
		.click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Market");
};

// Only the rows near the viewport are mounted; spacer rows are aria-hidden.
const dataRows = (page: Page) =>
	page
		.getByRole("table", { name: "Available players" })
		.locator("tbody tr[data-row-id]");

const firstRow = (page: Page) => dataRows(page).first();

test("T10: Market sorts players by monthly salary", async ({ appWindow }) => {
	await openMarket(appWindow);
	const table = appWindow.getByRole("table", { name: "Available players" });
	// 36 players plus the header row.
	await expect(table).toHaveAttribute("aria-rowcount", "37");
	const salary = table.getByRole("columnheader", { name: "Monthly salary" });
	await expect(salary).not.toHaveAttribute("aria-sort");

	await salary.getByRole("button").click();
	await expect(salary).toHaveAttribute("aria-sort", "ascending");
	await expect(firstRow(appWindow)).toContainText("Faro");
	await expect(firstRow(appWindow)).toContainText("€2,600");

	await salary.getByRole("button").click();
	await expect(salary).toHaveAttribute("aria-sort", "descending");
	await expect(firstRow(appWindow)).toContainText("Cobalto");
	await expect(firstRow(appWindow)).toContainText("€18,400");
});

test("Market keeps its header in view while the rows scroll", async ({
	appWindow,
}) => {
	await openMarket(appWindow);
	const region = appWindow.getByRole("region", { name: "Available players" });
	const header = appWindow
		.getByRole("columnheader", { name: "Player" })
		.getByRole("button");
	await expect
		.poll(() => region.evaluate((el) => el.scrollHeight > el.clientHeight))
		.toBe(true);
	await region.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	const [regionBox, headerBox] = await Promise.all([
		region.boundingBox(),
		header.boundingBox(),
	]);
	expect(headerBox?.y).toBeGreaterThanOrEqual(regionBox?.y ?? Number.NaN);
	expect(headerBox?.y).toBeLessThan((regionBox?.y ?? 0) + 40);
});

test("Market moves between rows with the arrow keys", async ({ appWindow }) => {
	await openMarket(appWindow);
	const rows = dataRows(appWindow);
	await rows.first().focus();
	await appWindow.keyboard.press("ArrowDown");
	await expect(rows.nth(1)).toBeFocused();
	await appWindow.keyboard.press("End");
	await expect(rows.last()).toBeFocused();
	await expect(rows.last()).toHaveAttribute("aria-rowindex", "37");
	await expect(rows.last()).toHaveCSS("outline-style", "solid");
});

test("Market combines filters, shows them as chips and clears them", async ({
	appWindow,
}) => {
	await openMarket(appWindow);
	const status = appWindow.getByRole("status");
	await expect(status).toHaveText("36 of 36 players");
	await appWindow.getByRole("button", { name: "Mid" }).click();
	await appWindow.getByRole("combobox", { name: "Team" }).click();
	await appWindow.getByRole("option", { name: "Bruma" }).click();
	await expect(status).toHaveText("2 of 36 players");
	await expect(dataRows(appWindow)).toHaveCount(2);
	const chips = appWindow.getByRole("list", { name: "Active filters" });
	await expect(chips.getByRole("listitem")).toHaveText([
		"Role: Mid",
		"Team: Bruma",
	]);
	await chips
		.getByRole("button", { name: "Remove filter Team: Bruma" })
		.click();
	await expect(status).toHaveText("8 of 36 players");
	await appWindow.getByRole("button", { name: "Clear filters" }).click();
	await expect(status).toHaveText("36 of 36 players");
});
