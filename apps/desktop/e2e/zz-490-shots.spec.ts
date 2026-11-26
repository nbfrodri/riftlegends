import { homedir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { launchApp } from "./fixtures";
import { makeDraftMoves } from "./quick-draft-flow";

// Local only (not committed): screenshots of the tournament flow with real content.

const out = join(homedir(), ".cache/rift-tmp");
const button = (page: Page, name: string) =>
	page.getByRole("button", { name, exact: true });
const heading = (page: Page, name: string) =>
	page.getByRole("heading", { level: 1, name, exact: true });

async function shots(page: Page, name: string) {
	for (const [width, height] of [
		[1280, 720],
		[1366, 768],
	] as const) {
		await page.setViewportSize({ width, height });
		await page.waitForTimeout(900);
		await page.screenshot({ path: join(out, `490-${name}-${width}x${height}.png`) });
		const fits = await page
			.getByRole("main")
			.evaluate(
				(el) =>
					el.scrollWidth <= el.clientWidth &&
					el.scrollHeight <= el.clientHeight,
			);
		console.log(`${name} fits ${width}x${height}: ${fits}`);
	}
	await page.setViewportSize({ width: 1280, height: 720 });
}

async function choose(page: Page, combobox: string, option: string) {
	await page.getByRole("combobox", { name: combobox }).click();
	await page.getByRole("option", { name: option, exact: true }).click();
}

test("tournament screenshots", async ({ playwright }) => {
	test.setTimeout(900_000);
	const app = await launchApp(
		{ playwright },
		{
			profileDir: join(out, "490-profile"),
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
	await nav.getByRole("button", { name: "Torneo" }).click();
	await page.getByRole("radio", { name: "Personalizado" }).check({ force: true });
	await choose(page, "Bloque", "Eliminación simple");
	for (const n of [8, 7, 6, 5]) await button(page, `Quitar equipo ${n}`).click();
	const mine =
		(await page.getByRole("combobox", { name: "Equipo 1" }).textContent()) ?? "";
	await choose(page, "Mi equipo", mine);
	await button(page, "Empezar torneo").click();
	await expect(heading(page, "Torneo personalizado")).toBeVisible();
	await page.waitForTimeout(1500);
	await shots(page, "hub");
	const advance = page.getByRole("group", { name: "Avance" });
	await advance.getByRole("button", { name: "Jugar día" }).click();
	const play = advance.getByRole("button", { name: "Jugar mi serie" });
	await expect(play).toBeEnabled({ timeout: 120_000 });
	await shots(page, "hub-pending");
	await page.getByRole("radio", { name: "Calendario" }).check({ force: true });
	await page.waitForTimeout(1200);
	await shots(page, "hub-calendar");
	const champion = page.getByText("Campeón de Torneo personalizado");
	let first = true;
	for (let step = 0; step < 12; step++) {
		if (await champion.isVisible()) break;
		if (await play.isVisible()) {
			await play.click();
			await expect(heading(page, "Lado y orden")).toBeVisible({ timeout: 60_000 });
			if (first) await shots(page, "series-side");
			await page.getByRole("radiogroup").getByRole("radio").last().check({ force: true });
			await button(page, "Confirmar decisión").click();
			await button(page, "Ir al draft").click();
			await expect(heading(page, "Draft")).toBeVisible();
			await makeDraftMoves(page);
			await button(page, "Confirmar reparto").click();
			await button(page, "Jugar").click();
			await button(page, "Saltar al final").click();
			await button(page, "Ver resultado").click();
			await expect(heading(page, "Resultado")).toBeVisible();
			await page.waitForTimeout(1500);
			if (first) await shots(page, "series-result");
			await button(page, "Volver al torneo").click();
			await page.waitForTimeout(1500);
			if (first) await shots(page, "hub-after");
			first = false;
			continue;
		}
		await advance.getByRole("button", { name: "Jugar día" }).click();
		await expect(advance.getByRole("button", { name: "Parar" })).toBeHidden({ timeout: 120_000 });
	}
	await expect(champion).toBeVisible();
	await page.waitForTimeout(2500);
	await shots(page, "champion");
	await button(page, "Ver el torneo").click();
	await page.waitForTimeout(1500);
	await shots(page, "hub-over");
	await app.close();
});
