import { expect, test } from "./fixtures";

test("S1: ban, pick and replay the turn with the keyboard", async ({
	appWindow,
}) => {
	await appWindow.emulateMedia({ reducedMotion: "reduce" });
	const ban = appWindow.getByRole("button", { name: "Ban Nimbo" });
	await ban.focus();
	await appWindow.keyboard.press("Enter");
	await expect(
		appWindow.getByRole("button", { name: "Lock in pick" }),
	).toBeFocused();
	await expect(appWindow.locator(".red .ban-strip")).toContainText("Nimbo");
	await appWindow.keyboard.press("Enter");
	await expect(appWindow.getByRole("status")).toHaveText("B4 locked · Veyra");
	await expect(appWindow.locator(".current-pick")).toContainText("Veyra");
	await expect(appWindow.locator(".sweep-layer")).toBeHidden();
	await appWindow.keyboard.press("Enter");
	await expect(ban).toBeFocused();
});
