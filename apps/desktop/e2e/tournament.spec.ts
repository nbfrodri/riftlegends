import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { makeDraftMoves } from "./quick-draft-flow";

// Plan 31, E1: a custom tournament of four teams (single elimination, Bo1)
// played with my team from start to finish, skipping the matches.

test.use({ systemLocale: "es-ES" });

const button = (page: Page, name: string) =>
	page.getByRole("button", { name, exact: true });
const heading = (page: Page, name: string) =>
	page.getByRole("heading", { level: 1, name, exact: true });

async function choose(page: Page, combobox: string, option: string) {
	await page.getByRole("combobox", { name: combobox }).click();
	await page.getByRole("option", { name: option, exact: true }).click();
}

/** One Bo1 of my team through Lado y orden, Draft, Roles, Plan, Partida and Resultado. */
async function playMySeries(page: Page) {
	await expect(heading(page, "Lado y orden")).toBeVisible();
	await page
		.getByRole("radiogroup")
		.getByRole("radio")
		.last()
		.check({ force: true });
	await button(page, "Confirmar decisión").click();
	await button(page, "Ir al draft").click();
	await expect(heading(page, "Draft")).toBeVisible();
	await makeDraftMoves(page);
	await expect(heading(page, "Roles")).toBeVisible();
	await button(page, "Confirmar reparto").click();
	await expect(heading(page, "Plan de partida")).toBeVisible();
	await button(page, "Jugar").click();
	await button(page, "Saltar al final").click();
	await button(page, "Ver resultado").click();
	await expect(heading(page, "Resultado")).toBeVisible();
	await button(page, "Volver al torneo").click();
}

test("E1: a custom tournament played with my team from start to finish", async ({
	appWindow: page,
}) => {
	test.setTimeout(240_000);
	await page
		.getByRole("navigation", { name: "Secciones del club" })
		.getByRole("button", { name: "Torneo" })
		.click();
	await choose(page, "Bloque", "Eliminación simple");
	for (const n of [8, 7, 6, 5])
		await button(page, `Quitar equipo ${n}`).click();
	const mine =
		(await page.getByRole("combobox", { name: "Equipo 1" }).textContent()) ??
		"";
	await choose(page, "Mi equipo", mine);
	await button(page, "Empezar torneo").click();
	await expect(heading(page, "Torneo personalizado")).toBeVisible();
	await expect(page.getByText(`Juegas con ${mine}.`)).toBeVisible();

	const advance = page.getByRole("group", { name: "Avance" });
	const champion = page.getByText("Campeón de Torneo personalizado");
	const out = page.getByText(`${mine} queda fuera del torneo.`);
	let series = 0;
	let spectator = false;
	const play = advance.getByRole("button", { name: "Jugar mi serie" });
	const playDay = advance.getByRole("button", {
		name: "Jugar día",
		disabled: false,
	});
	for (let step = 0; step < 12; step++) {
		// After a day the hub settles into one of three states; read it only
		// then, or a pending series can still be on its way.
		await expect(champion.or(play).or(playDay).first()).toBeVisible();
		if (await champion.isVisible()) break;
		if (await play.isVisible()) {
			await play.click();
			await playMySeries(page);
			series++;
			await expect(
				champion.or(out).or(page.getByText(`Juegas con ${mine}.`)),
			).toBeVisible();
			spectator ||= await out.isVisible();
			continue;
		}
		await playDay.click();
		await expect(advance.getByRole("button", { name: "Parar" })).toBeHidden();
	}
	await expect(champion).toBeVisible();
	await expect(page.getByText(/^Final: /)).toBeVisible();
	// Out in the semifinal and the final watched as a spectator, or the final
	// played: won or lost, depending on the seed.
	expect(series).toBe(spectator ? 1 : 2);
	const won = page.getByText("Tu equipo ha ganado el torneo.");
	const lost = page.getByText(`${mine} no lo ha ganado esta vez.`);
	await expect(spectator ? lost : won.or(lost)).toBeVisible();
	await button(page, "Nuevo torneo").click();
	await expect(button(page, "Empezar torneo")).toBeVisible();
});
