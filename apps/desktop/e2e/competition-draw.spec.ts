import { expect, test } from "./fixtures";

// SO15 (plan 12 §6, #628): once the regular stage is over, the hub tells the
// draw of the playoffs before their first series, without page scroll.

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`the hub shows the playoff draw and fits the window at ${width}x${height}`, async ({
		appWindow,
	}) => {
		await appWindow.setViewportSize({ width, height });
		await appWindow
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Competition" })
			.click();
		const stageEnd = appWindow
			.getByRole("group", { name: "Advance" })
			.getByRole("button", { name: "Until end of stage" });
		await stageEnd.click();
		const cards = appWindow.getByRole("list", { name: "Competitions" });
		const card = cards.getByRole("button", { name: /Rift League/ });
		// The regular stage is over when the card moves on to the playoffs.
		await expect(cards.getByRole("listitem")).toContainText("Playoffs", {
			timeout: 60_000,
		});
		await expect(stageEnd).toBeEnabled();
		await card.click();
		// The playoffs have teams but no day yet, so the hub still opens the regular stage.
		await appWindow.getByRole("combobox", { name: "Stage" }).click();
		await appWindow
			.getByRole("option", { name: "Playoffs", exact: true })
			.click();
		await appWindow
			.getByRole("radiogroup", { name: "View" })
			.getByRole("radio", { name: "Bracket" })
			.check({ force: true });
		const draw = appWindow.getByRole("region", { name: "Draw: Semifinal" });
		await expect(draw).toBeVisible({ timeout: 30_000 });
		// Seeds 1 and 2 (tier 1) meet seeds 3 and 4 (tier 2), as sentences.
		const lines = draw.getByRole("listitem");
		await expect(lines).toHaveCount(2);
		for (const line of await lines.allTextContents())
			expect(line).toMatch(/^.+, tier [12], against .+, tier [12]$/);
		// Everyone met in the regular stage, so the rematch rule is told as relaxed.
		await expect(
			draw.getByText("Rematch: no other pairing was possible"),
		).toBeVisible();
		expect(await draw.textContent()).not.toContain("·");
		// No series of the stage has been played yet.
		await expect(appWindow.getByRole("button", { name: /\d–\d/ })).toHaveCount(
			0,
		);
		expect(
			await appWindow
				.getByRole("main")
				.evaluate(
					(el) =>
						el.scrollWidth === el.clientWidth &&
						el.scrollHeight === el.clientHeight,
				),
		).toBe(true);
	});
}
