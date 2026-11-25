import { expect, test } from "./fixtures";
import { flagBaselineOffset } from "./flag-baseline";

test.describe("with the fictional set (test seam)", () => {
	test.use({ appEnv: { RIFT_E2E_CONTENT: "fictional" } });

	for (const [width, height] of [
		[1280, 720],
		[1366, 768],
	] as const) {
		test(`browses players, teams and coaches at ${width}x${height}`, async ({
			appWindow,
		}) => {
			await appWindow.setViewportSize({ width, height });
			await appWindow
				.getByRole("navigation", { name: "Club sections" })
				.getByRole("button", { name: "Database" })
				.click();
			await expect(
				appWindow.getByRole("heading", { level: 1, name: "Database" }),
			).toBeVisible();
			await expect(appWindow.getByRole("status")).toHaveText(
				"40 of 40 players",
			);
			// Nothing scrolls but the table: the page fits the window.
			expect(
				await appWindow
					.getByRole("main")
					.evaluate(
						(el) =>
							el.scrollWidth === el.clientWidth &&
							el.scrollHeight === el.clientHeight,
					),
			).toBe(true);

			const panel = appWindow.getByRole("complementary", { name: "Filters" });
			await panel.getByRole("button", { name: "Mid" }).click();
			await expect(appWindow.getByRole("status")).toHaveText("8 of 40 players");
			const row = appWindow.getByRole("row", { name: /Kilnara/ });
			await row.click();
			const card = appWindow.getByRole("dialog", {
				name: "Player card: Kilnara",
			});
			await expect(card.getByRole("heading", { name: "Lane" })).toBeVisible();
			await expect(card).toBeInViewport({ ratio: 1 });
			await appWindow.keyboard.press("Escape");
			await expect(card).toBeHidden();
			await expect(row).toBeFocused();

			const tabs = appWindow.getByRole("radiogroup", { name: "Section" });
			await tabs.getByText("Teams").click();
			await expect(
				appWindow
					.getByRole("list", { name: "All teams" })
					.getByRole("heading", { level: 2 }),
			).toHaveCount(8);
			await tabs.getByText("Coaches").click();
			await expect(appWindow.getByRole("status")).toHaveText("8 of 8 coaches");
		});
	}

	for (const [width, height] of [
		[1280, 720],
		[1366, 768],
	] as const) {
		test(`the player card fills most of the content area at ${width}x${height}`, async ({
			appWindow,
		}) => {
			await appWindow.setViewportSize({ width, height });
			await appWindow
				.getByRole("navigation", { name: "Club sections" })
				.getByRole("button", { name: "Database" })
				.click();
			await appWindow.getByRole("row", { name: /Kilnara/ }).click();
			const card = appWindow.getByRole("dialog", {
				name: "Player card: Kilnara",
			});
			await expect(card.getByRole("heading", { name: "Lane" })).toBeVisible();
			const box = await card.boundingBox();
			const area = await appWindow.getByRole("main").boundingBox();
			if (!box || !area) throw new Error("no layout");
			// At least ~75 % of the usable content area, inside the window.
			expect(box.width).toBeGreaterThanOrEqual(area.width * 0.75);
			expect(box.height).toBeGreaterThanOrEqual(area.height * 0.75);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.y).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
			expect(box.y + box.height).toBeLessThanOrEqual(height);
			// #558: the whole card, pool included, fits without scrolling inside.
			await expect(card.getByRole("list", { name: "Weak" })).toBeVisible();
			expect(
				await card.evaluate((el) => el.scrollHeight - el.clientHeight),
			).toBeLessThanOrEqual(0);
			// The page itself never scrolls.
			expect(
				await appWindow.evaluate(() => {
					const page = document.scrollingElement ?? document.documentElement;
					return (
						page.scrollHeight <= page.clientHeight &&
						page.scrollWidth <= page.clientWidth
					);
				}),
			).toBe(true);
		});
	}

	test("the card's flag sits on the baseline of the big name", async ({
		appWindow,
	}) => {
		await appWindow
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Database" })
			.click();
		await appWindow.getByRole("row", { name: /Kilnara/ }).click();
		const heading = appWindow
			.getByRole("dialog", { name: "Player card: Kilnara" })
			.getByRole("heading", { level: 2, name: "Kilnara" });
		const offset = await flagBaselineOffset(heading);
		expect(Math.abs(offset)).toBeLessThanOrEqual(1.5);
	});
});
