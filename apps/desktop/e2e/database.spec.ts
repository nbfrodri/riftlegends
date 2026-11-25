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
		await expect(heading.getByRole("img")).toBeVisible();
		const offset = await heading.evaluate(async (el) => {
			await document.fonts.ready;
			const text = [...el.childNodes].find(
				(node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
			);
			const flag = el.querySelector("svg");
			const context = document.createElement("canvas").getContext("2d");
			if (!text || !flag || !context) return Number.NaN;
			const style = getComputedStyle(el);
			context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const metrics = context.measureText(text.textContent ?? "");
			const range = document.createRange();
			range.selectNodeContents(text);
			const box = range.getBoundingClientRect();
			const contentArea =
				metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
			const baseline =
				box.top +
				(box.height - contentArea) / 2 +
				metrics.fontBoundingBoxAscent;
			return flag.getBoundingClientRect().bottom - baseline;
		});
		expect(Math.abs(offset)).toBeLessThanOrEqual(1.5);
	});
});
