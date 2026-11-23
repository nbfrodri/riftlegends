import { expect, test } from "./fixtures";
import { seedNextSeries } from "./quick-draft-flow";

test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

test("pins a champion card without selecting a ban", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const player = appWindow.getByRole("group", { name: "Player card" });
	await player.getByText("Player card", { exact: true }).click();
	await expect(
		player.getByRole("img", { name: "Portrait of Kilnara" }),
	).toBeVisible();
	const tile = appWindow.getByRole("button", { name: "Cragbell", exact: true });
	await tile.click({ button: "right" });
	const card = appWindow.getByRole("region", {
		name: "Champion card: Cragbell",
	});
	await expect(card.getByText("Rimefoil")).toBeVisible();
	await expect(
		appWindow.getByRole("button", { name: "Confirm ban" }),
	).toBeDisabled();
	await appWindow.keyboard.press("Escape");
	await expect(card).toHaveCount(0);
	await expect(tile).toBeFocused();
});

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

// #376: the board and the panels under it stay together at any window size,
// and nothing scrolls at the minimum and default sizes.
test("the draft fits and keeps the player card right under the board", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const board = appWindow.getByRole("region", { name: "Blue side Forge" });
	const card = appWindow.getByRole("group", { name: /Player card/ });
	for (const viewport of [
		{ width: 1280, height: 720 },
		{ width: 1366, height: 768 },
		{ width: 1920, height: 1080 },
	]) {
		await appWindow.setViewportSize(viewport);
		await expect(card).toBeInViewport({ ratio: 1 });
		const above = await board.boundingBox();
		const below = await card.boundingBox();
		if (!above || !below) throw new Error("The board and the card must show");
		const gap = below.y - (above.y + above.height);
		expect(gap).toBeGreaterThanOrEqual(0);
		expect(gap).toBeLessThanOrEqual(24);
		expect(
			await appWindow.evaluate(() => {
				const main = document.querySelector("main");
				return {
					page: document.documentElement.scrollHeight - innerHeight,
					main: main ? main.scrollHeight - main.clientHeight : 0,
				};
			}),
		).toEqual({ page: 0, main: 0 });
	}
});
