import { expect, test } from "./fixtures";

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
});
