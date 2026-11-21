import { expect, test } from "./fixtures";

test("keeps the AI panel preference when the draft screen is reopened", async ({
	appWindow,
}) => {
	async function openDraft() {
		await appWindow.getByRole("button", { name: "Start series" }).click();
		await appWindow.getByRole("button", { name: "Go to draft" }).click();
	}

	await openDraft();
	const panel = appWindow.getByRole("group", { name: "AI decisions" });
	const empty = panel.getByText("The rival has not made a decision yet.");
	await expect(panel).not.toHaveAttribute("open", "");
	await panel.getByText("AI decisions").click();
	await expect(empty).toBeVisible();

	const navigation = appWindow.getByRole("navigation", {
		name: "Club sections",
	});
	await navigation.getByRole("button", { name: "Market" }).click();
	await navigation.getByRole("button", { name: "Draft" }).click();
	await openDraft();
	await expect(empty).toBeVisible();
});
