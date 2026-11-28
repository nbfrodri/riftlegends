import { expect, test } from "./fixtures";

// #640: a click on a roster row of the team page opens the player card, and
// Escape closes it and gives the focus back to the row.

test("the roster opens the player card and Escape gives the focus back", async ({
	appWindow,
}) => {
	await appWindow.setViewportSize({ width: 1280, height: 720 });
	await appWindow
		.getByRole("navigation", { name: "Club sections" })
		.getByRole("button", { name: "Competition" })
		.click();
	await appWindow
		.getByRole("list", { name: "Competitions" })
		.getByRole("button", { name: /Rift League/ })
		.click();
	await appWindow
		.getByRole("table", { name: "Standings: Regular" })
		.locator('tr[data-row-id="forge"]')
		.click();
	await expect(
		appWindow.getByRole("heading", { level: 1, name: "Forge" }),
	).toBeVisible();
	const row = appWindow
		.getByRole("table", { name: "Roster" })
		.getByRole("row")
		.nth(1);
	await row.click();
	const card = appWindow.getByRole("dialog", { name: /^Player card: / });
	await expect(card).toBeVisible();
	await expect(
		card.getByRole("heading", { level: 2, name: "Emberjaw" }),
	).toBeVisible();
	if (process.env.RIFT_CARD_SHOT)
		await appWindow.screenshot({ path: process.env.RIFT_CARD_SHOT });
	await appWindow.keyboard.press("Escape");
	await expect(card).toBeHidden();
	await expect(row).toBeFocused();
});
