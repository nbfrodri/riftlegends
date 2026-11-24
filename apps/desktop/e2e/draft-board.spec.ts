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
	// #430: the open card drops over the board; close it to reach the pool.
	await player.getByText("Player card", { exact: true }).click();
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

// #376 #430: the bars above the board stay right on top of it at any window
// size, and nothing scrolls at the minimum and default sizes.
test("the draft fits and keeps the player card right above the board", async ({
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
		const above = await card.boundingBox();
		const below = await board.boundingBox();
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

// #398: opening the champion card from the pool keeps the pool where it was.
test("opening a champion card keeps the pool's scroll position", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const grid = appWindow.getByRole("group", { name: "Champions" });
	const scrollTop = () => grid.evaluate((node) => node.scrollTop);
	await grid.evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});
	const before = await scrollTop();
	expect(before).toBeGreaterThan(0);
	const last = grid.getByRole("button").last();
	await last.click({ button: "right" });
	await expect(appWindow.locator("[data-champion-card]")).toBeVisible();
	expect(await scrollTop()).toBe(before);
	await appWindow.keyboard.press("Escape");
	await expect(appWindow.locator("[data-champion-card]")).toHaveCount(0);
	expect(await scrollTop()).toBe(before);
	await last.press("i");
	await expect(appWindow.locator("[data-champion-card]")).toBeVisible();
	expect(await scrollTop()).toBe(before);
});

// #396 #430: each open panel drops over the board from its bar, without
// moving the board or scrolling the page.
test("each open panel drops below its bar without scrolling the page", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const board = appWindow.getByRole("region", { name: "Blue side Forge" });
	const panels = [
		{ name: "Player card", ready: "Composure" },
		{ name: "AI decisions", ready: null },
	];
	for (const { name, ready } of panels) {
		const group = appWindow.getByRole("group", {
			name: new RegExp(`^${name}`),
		});
		const bar = group.locator("summary");
		const body = group.locator('[data-slot="panel-body"]');
		for (const viewport of [
			{ width: 1280, height: 720 },
			{ width: 1366, height: 768 },
		]) {
			await appWindow.setViewportSize(viewport);
			const closedBoard = await board.boundingBox();
			if (!(await group.evaluate((e) => (e as HTMLDetailsElement).open)))
				await bar.click();
			await expect(body).toBeVisible();
			if (ready) await expect(body.getByText(ready)).toBeInViewport();
			const top = await bar.boundingBox();
			const panel = await body.boundingBox();
			const openBoard = await board.boundingBox();
			if (!top || !panel || !openBoard || !closedBoard)
				throw new Error("The bar, its panel and the board must show");
			// The panel hangs from its bar, over the board, inside the window.
			expect(panel.y).toBeGreaterThanOrEqual(top.y + top.height - 1);
			expect(panel.y).toBeLessThan(openBoard.y + openBoard.height);
			expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
			expect(openBoard).toEqual(closedBoard);
			expect(
				await appWindow.evaluate(() => {
					const main = document.querySelector("main");
					return {
						page: document.documentElement.scrollHeight - innerHeight,
						main: main ? main.scrollHeight - main.clientHeight : 0,
					};
				}),
			).toEqual({ page: 0, main: 0 });
			await bar.click();
			await expect(body).toBeHidden();
		}
	}
});

// #419: the turn timer is one line above the board, from the blue column's
// left edge to the red column's right edge, and the page still does not scroll.
test("the turn timer spans the whole board right above it", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow
		.getByRole("radio", { name: "On", exact: true })
		.check({ force: true });
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const timer = appWindow.getByRole("timer");
	await expect(timer).toBeVisible();
	const blue = appWindow.getByRole("region", { name: /^Blue side / });
	const red = appWindow.getByRole("region", { name: /^Red side / });
	for (const viewport of [
		{ width: 1280, height: 720 },
		{ width: 1366, height: 768 },
	]) {
		await appWindow.setViewportSize(viewport);
		const bar = await timer.boundingBox();
		const left = await blue.boundingBox();
		const right = await red.boundingBox();
		if (!bar || !left || !right) throw new Error("The board must show");
		expect(Math.abs(bar.x - left.x)).toBeLessThanOrEqual(1);
		expect(
			Math.abs(bar.x + bar.width - (right.x + right.width)),
		).toBeLessThanOrEqual(1);
		const above = left.y - (bar.y + bar.height);
		expect(above).toBeGreaterThanOrEqual(0);
		expect(above).toBeLessThanOrEqual(12);
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

test("#469: a click on empty space drops the pick preview", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const grid = appWindow.getByRole("group", { name: "Champions" });
	const free = grid.locator("button:not([aria-disabled])").first();
	for (let ban = 1; ban <= 3; ban++) {
		await expect(appWindow.getByText(`Ban ${ban} · Forge`)).toBeVisible();
		await free.click();
		await appWindow.getByRole("button", { name: "Confirm ban" }).click();
	}
	await expect(appWindow.getByText("B1 · Forge pick")).toBeVisible();

	const name = (await free.getAttribute("aria-label")) ?? "";
	await free.click();
	const blue = appWindow.getByRole("region", { name: "Blue side Forge" });
	const row = blue.getByRole("listitem").first();
	const confirm = appWindow.getByRole("button", { name: "Confirm pick" });
	await expect(row.getByRole("img", { name })).toBeVisible();
	await expect(confirm).toBeEnabled();

	// The gap between the blue column and the pool is empty space.
	const box = await blue.boundingBox();
	if (!box) throw new Error("The blue column must be visible");
	await appWindow.mouse.click(box.x + box.width + 6, box.y + box.height / 2);

	await expect(row.getByRole("img", { name })).toHaveCount(0);
	await expect(confirm).toBeDisabled();
	await expect(grid.getByRole("button", { name, exact: true })).toHaveAttribute(
		"aria-pressed",
		"false",
	);
});

// #471: the pool's scrollbar sits at the panel's right edge, at least the
// grid's gap away from the last column, and its space stays reserved so the
// tiles keep their width when a filter leaves nothing to scroll.
test("the pool's scrollbar sits at the panel edge, a grid gap from the tiles", async ({
	appWindow,
	electronApp,
}) => {
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();
	const grid = appWindow.getByRole("group", { name: "Champions" });
	const search = appWindow.getByRole("searchbox");
	const measure = () =>
		grid.evaluate((node) => {
			const box = node.getBoundingClientRect();
			const panel = node.closest("section")?.getBoundingClientRect();
			const tiles = [...node.querySelectorAll("button")].map((tile) =>
				tile.getBoundingClientRect(),
			);
			return {
				scrolls: node.scrollHeight > node.clientHeight,
				gap: Number.parseFloat(getComputedStyle(node).columnGap),
				// A fieldset scrolls an anonymous inner box, so its clientWidth
				// keeps the bar; the Caja bar is 8 px wide (#307).
				bar: box.right - 8,
				edge: (panel?.right ?? 0) - box.right,
				lastColumn: Math.max(...tiles.map((tile) => tile.right)),
				tileWidth: tiles[0]?.width ?? 0,
			};
		});
	for (const viewport of [
		{ width: 1280, height: 720 },
		{ width: 1366, height: 768 },
	]) {
		await appWindow.setViewportSize(viewport);
		await search.fill("");
		const full = await measure();
		expect(full.scrolls).toBe(true);
		expect(full.bar - full.lastColumn).toBeGreaterThanOrEqual(full.gap);
		expect(full.edge).toBeLessThanOrEqual(4);
		await search.fill("Cragbell");
		await expect(grid.getByRole("button")).toHaveCount(1);
		const filtered = await measure();
		expect(filtered.scrolls).toBe(false);
		expect(filtered.tileWidth).toBeCloseTo(full.tileWidth, 1);
	}
});
