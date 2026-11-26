import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp } from "./fixtures";

// Local only (not committed): calendar and tournament screenshots with real content.

const out = join(homedir(), ".cache/rift-tmp");
const tag = process.env.SHOT_TAG ?? "cal";

test("calendar and tournament screenshots", async ({ playwright }) => {
	test.setTimeout(600_000);
	const app = await launchApp(
		{ playwright },
		{
			profileDir: join(out, "cal-profile"),
			systemLocale: "es-ES",
			env: { RIFT_E2E_CONTENT: "real" },
		},
	);
	const page = await app.firstWindow();
	await page.setViewportSize({ width: 1280, height: 720 });
	const continueButton = page.getByRole("button", { name: "Continuar" });
	const nav = page.getByRole("navigation", { name: "Secciones del club" });
	await expect(nav.or(continueButton).first()).toBeVisible({ timeout: 120_000 });
	if (await continueButton.isVisible()) await continueButton.click();
	await nav.getByRole("button", { name: "Calendario" }).click();
	const grid = page.getByRole("grid");
	await expect(grid).toBeVisible({ timeout: 120_000 });
	for (const [width, height] of [
		[1280, 720],
		[1366, 768],
	] as const) {
		await page.setViewportSize({ width, height });
		for (const mode of ["Mes", "Semana"]) {
			await page.getByRole("radio", { name: mode }).check({ force: true });
			await page.waitForTimeout(1200);
			const scroll = grid.locator("xpath=..");
			const info = await scroll.evaluate((el) => {
				el.scrollTop = 60;
				return [el.scrollHeight, el.clientHeight, el.scrollTop];
			});
			console.log(mode, width, info);
			await page.waitForTimeout(400);
			await page.screenshot({
				path: join(out, `${tag}-${mode === "Mes" ? "month" : "week"}-scrolled-${width}x${height}.png`),
			});
		}
		await page.getByRole("combobox", { name: "Competición" }).click();
		await page.waitForTimeout(600);
		await page.screenshot({ path: join(out, `${tag}-competition-open-${width}x${height}.png`) });
		await page.keyboard.press("Escape");
		await page.getByRole("combobox", { name: "Equipo" }).click();
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(out, `${tag}-team-open-${width}x${height}.png`) });
		await page.keyboard.press("Escape");
	}
	if (process.env.SHOT_TOURNAMENT) {
		await page.setViewportSize({ width: 1280, height: 720 });
		await nav.getByRole("button", { name: "Torneo" }).click();
		await page.waitForTimeout(2500);
		await page.screenshot({ path: join(out, `${tag}-tournament-1280x720.png`) });
		await page.getByRole("main").getByRole("combobox").nth(1).click();
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(out, `${tag}-tournament-open-1280x720.png`) });
		await page.keyboard.press("Escape");
		await page.getByRole("combobox", { name: "Mi equipo" }).click();
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(out, `${tag}-tournament-myteam-1280x720.png`) });
	}
	await app.close();
});
