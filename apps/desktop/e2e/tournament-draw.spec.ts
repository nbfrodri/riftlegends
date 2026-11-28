import { expect, test } from "./fixtures";

// SO15 (plan 12 §6, #628): with the MSI preset of Torneo, the hub tells the
// draw of the bracket before its first series, without page scroll.

test.use({
	systemLocale: "es-ES",
	appEnv: { RIFT_E2E_CORE: "1", RIFT_E2E_CONTENT: "real" },
	seedAssetCache: true,
});

for (const [width, height] of [
	[1280, 720],
	[1366, 768],
] as const) {
	test(`the MSI draw shows in the tournament hub and fits the window at ${width}x${height}`, async ({
		appWindow: page,
	}) => {
		test.setTimeout(240_000);
		await page.setViewportSize({ width, height });
		// The seeded cache lacks the official sounds and the network is off (#555).
		await page
			.getByRole("button", { name: "Continuar", exact: true })
			.click({ timeout: 15_000 });
		await page
			.getByRole("navigation", { name: "Secciones del club" })
			.getByRole("button", { name: "Torneo" })
			.click();
		await page.getByRole("button", { name: "Empezar torneo" }).click();
		// The play-in is over when «Hasta fin de fase» is enabled again with the bracket next.
		const advance = page.getByRole("group", { name: "Avance" });
		await advance.getByRole("button", { name: "Hasta fin de fase" }).click();
		await page.getByRole("combobox", { name: "Fase" }).click();
		await page
			.getByRole("option", { name: /Cuadro|Bracket/ })
			.first()
			.click();
		await page
			.getByRole("radiogroup", { name: "Vista" })
			.getByRole("radio", { name: "Cuadro" })
			.check({ force: true });
		await expect(
			page.getByText("Sorteo por niveles: 1 contra 4, 2 contra 3", {
				exact: true,
			}),
		).toBeVisible({ timeout: 60_000 });
		const bracket = page.getByRole("group", { name: "Cuadro", exact: true });
		const drawn = bracket.getByRole("button", {
			name: /: .+, nivel [1-4], [A-Z]+, contra .+, nivel [1-4], [A-Z]+$/,
		});
		await expect(drawn).toHaveCount(4);
		await expect(bracket.getByText(/^N[1-4]$/)).toHaveCount(8);
		for (const container of [page.getByRole("main"), bracket]) {
			const size = await container.evaluate((el) => ({
				width: el.clientWidth,
				height: el.clientHeight,
				scrollWidth: el.scrollWidth,
				scrollHeight: el.scrollHeight,
			}));
			expect([size.scrollWidth, size.scrollHeight], String(container)).toEqual([
				size.width,
				size.height,
			]);
		}
		const cardWidths = await bracket
			.getByRole("button")
			.evaluateAll((cards) =>
				cards.map((card) => card.getBoundingClientRect().width),
			);
		expect(new Set(cardWidths)).toEqual(new Set([168]));
		if (process.env.RIFT_DRAW_SHOTS)
			await page.screenshot({
				path: `${process.env.RIFT_DRAW_SHOTS}/628b-${width}x${height}.png`,
			});
	});
}
