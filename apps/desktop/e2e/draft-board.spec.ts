import { expect, test } from "./fixtures";
import { seedNextSeries } from "./quick-draft-flow";

test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

// Plan 09, U3 in the real app: from the setup, the user's first ban reaches
// the core and the board shows it.
test("makes the user's first ban from the setup", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	await expect(appWindow.getByText("Ban 1 · Forge")).toBeVisible();

	const grid = appWindow.getByRole("group", { name: "Champions" });
	await grid.getByRole("button", { name: "Cragbell" }).click();
	await appWindow.getByRole("button", { name: "Confirm ban" }).click();

	await expect(
		grid.getByRole("button", { name: "Cragbell. Banned in this game" }),
	).toBeVisible();
	await expect(
		appWindow
			.getByRole("list", { name: "Bans" })
			.first()
			.getByRole("img", { name: "Cragbell" }),
	).toBeVisible();
	await expect(appWindow.getByText("Shoal's turn")).toBeVisible();
});

test("search and all six role buttons fit on one row in the champion pool", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const filters = appWindow.getByRole("group", { name: "Filter by role" });
	const buttons = filters.getByRole("button");
	await expect(buttons).toHaveCount(6);

	for (const viewport of [
		{ width: 1280, height: 720 },
		{ width: 1366, height: 768 },
	]) {
		await appWindow.setViewportSize(viewport);
		const search = await appWindow.getByRole("searchbox").boundingBox();
		const grid = await appWindow
			.getByRole("group", { name: "Champions" })
			.boundingBox();
		if (!search || !grid) throw new Error("The champion pool must be visible");
		expect(search.width).toBeGreaterThan(0);
		expect(search.x).toBeGreaterThanOrEqual(grid.x);
		const midline = search.y + search.height / 2;
		let right = search.x + search.width;
		for (const button of await buttons.all()) {
			const box = await button.boundingBox();
			if (!box) throw new Error("The role button must be visible");
			expect(box.y).toBeLessThan(midline);
			expect(box.y + box.height).toBeGreaterThan(midline);
			expect(box.x).toBeGreaterThanOrEqual(right);
			right = box.x + box.width;
		}
		expect(right).toBeLessThanOrEqual(grid.x + grid.width);
	}
});
