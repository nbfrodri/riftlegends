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
		const draw = page.getByRole("region", { name: /^Sorteo: / });
		await expect(draw).toBeVisible({ timeout: 60_000 });
		for (const line of await draw.getByRole("listitem").allTextContents())
			expect(line).toMatch(/^.+, nivel [1-4], contra .+, nivel [1-4]$/);
		await expect(draw.getByRole("listitem")).toHaveCount(4);
		expect(await draw.textContent()).not.toContain("·");
		expect(
			await page
				.getByRole("main")
				.evaluate(
					(el) =>
						el.scrollWidth === el.clientWidth &&
						el.scrollHeight === el.clientHeight,
				),
		).toBe(true);
		if (process.env.RIFT_DRAW_SHOTS)
			await page.screenshot({
				path: `${process.env.RIFT_DRAW_SHOTS}/628-${width}x${height}.png`,
			});
	});
}
