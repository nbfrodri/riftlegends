import { expect, test } from "./fixtures";

// Plan 09, U3 in the real app: from the setup, the user's first ban reaches
// the core and the board shows it.
test("makes the user's first ban from the setup", async ({ appWindow }) => {
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	await expect(appWindow.getByText("Ban 1 · Forge")).toBeVisible();

	const grid = appWindow.getByRole("group", { name: "Champions" });
	await grid.getByRole("button", { name: "Cragbell" }).click();
	await appWindow.getByRole("button", { name: "Confirm ban" }).click();

	await expect(
		grid.getByRole("button", { name: "Cragbell. Banned in this game" }),
	).toBeVisible();
	await expect(
		appWindow.getByRole("list", { name: "Bans" }).first(),
	).toContainText("Cragbell");
	await expect(appWindow.getByText("Shoal's turn")).toBeVisible();
});
