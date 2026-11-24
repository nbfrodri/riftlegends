import type { ElectronApplication, Page } from "@playwright/test";
import type { CoreBridge } from "../src/main/core-bridge";
import { expect } from "./fixtures";

declare const riftCore: CoreBridge;

type QuickDraftScreen =
	| "setup"
	| "side-choice"
	| "draft"
	| "roles"
	| "game-plan"
	| "match"
	| "game-result"
	| "series-result";

/** Pin only the series root seed. Both choices still go through the real core. */
export async function seedNextSeries(app: ElectronApplication, seed: number) {
	await app.evaluate((_, seed) => {
		const { send } = riftCore;
		riftCore.send = (body) => {
			const command = JSON.parse(body);
			if (command.kind !== "series.start") return send(body);
			riftCore.send = send;
			command.payload.seed = seed;
			return send(JSON.stringify(command));
		};
	}, seed);
}

export async function playQuickDraftBo5(
	app: ElectronApplication,
	page: Page,
	capture?: (screen: QuickDraftScreen) => Promise<void>,
	inspectChoices?: () => Promise<void>,
) {
	await seedNextSeries(app, 198);

	const heading = (name: string) =>
		page.getByRole("heading", { level: 1, name, exact: true });
	const button = (name: string) =>
		page.getByRole("button", { name, exact: true });
	const choices = page.getByRole("radiogroup").getByRole("radio");
	const draft = heading("Draft");

	await expect(heading("Configurar serie")).toBeVisible();
	await page.getByRole("radio", { name: "Bo5" }).check({ force: true });
	// Fearless hard is the default: champions played earlier are locked.
	await expect(
		page.getByRole("radio", { name: "Hard", exact: true }),
	).toBeChecked();
	await capture?.("setup");
	await button("Empezar serie").click();

	const wins = { Forge: 0, Shoal: 0 };
	for (let game = 1; game <= 5; game++) {
		await expect(heading("Lado y orden")).toBeVisible();
		await expect(choices.first()).toBeVisible();
		await inspectChoices?.();
		if (game === 1) await capture?.("side-choice");
		await choices.last().check({ force: true });
		await button("Confirmar decisión").click();
		await expect(button("Ir al draft")).toBeVisible();
		const decisions = page
			.getByRole("list", { name: "Decisiones" })
			.getByRole("listitem");
		await expect(decisions).toHaveCount(2);
		await expect(decisions.filter({ hasText: "Pendiente" })).toHaveCount(0);
		await expect(page.getByText(/Motivo del coach/)).toBeVisible();
		await button("Ir al draft").click();

		await expect(draft).toBeVisible();
		await makeDraftMoves(page, game === 1 ? capture : undefined);

		await expect(heading("Roles")).toBeVisible();
		const own = page.getByRole("region", { name: "Quinteto de Forge" });
		const rival = page.getByRole("region", { name: "Quinteto de Shoal" });
		await expect(rival.getByRole("article")).toHaveCount(5);
		const swaps = own.getByRole("button", { name: /^Intercambiar / });
		await expect(swaps).toHaveCount(5);
		const first = await swaps.first().getAttribute("aria-label");
		await swaps.first().click();
		await expect(own.locator('[data-swap="pending"]')).toHaveCount(1);
		await own.getByRole("article").nth(1).click();
		await expect(swaps.nth(1)).toHaveAttribute("aria-label", first ?? "");
		await expect(
			page.getByRole("status").filter({ hasText: "Intercambiados" }),
		).toBeVisible();
		if (game === 1) await capture?.("roles");
		await button("Confirmar reparto").click();

		await expect(heading("Plan de partida")).toBeVisible();
		if (game === 1) await capture?.("game-plan");
		await button("Jugar").click();

		await expect(heading("Partida en curso")).toBeVisible();
		await button("Saltar al final").click();
		await expect(button("Ver resultado")).toBeVisible();
		if (game === 1) await capture?.("match");
		await button("Ver resultado").click();

		await expect(heading("Resultado")).toBeVisible();
		const winnerHeading = page.getByRole("heading", {
			level: 2,
			name: /^Victoria de (Forge|Shoal)$/,
		});
		await expect(winnerHeading).toBeVisible();
		const winner =
			(await winnerHeading.textContent()) === "Victoria de Forge"
				? "Forge"
				: "Shoal";
		wins[winner]++;

		if (wins[winner] === 3) {
			await expect(
				page.getByText("Ganador de la serie", { exact: true }),
			).toBeVisible();
			const score = page.getByRole("group", { name: "Marcador de la serie" });
			await expect(score).toHaveText(
				new RegExp(
					`Forge\\s*${wins.Forge} – ${wins.Shoal}\\s*Shoal|Shoal\\s*${wins.Shoal} – ${wins.Forge}\\s*Forge`,
				),
			);
			const recap = page.getByRole("table", { name: "Recorrido de la serie" });
			await expect(recap.getByRole("row")).toHaveCount(game + 1);
			await expect(
				page.getByRole("region", { name: "MVP de la serie" }),
			).toBeVisible();
			await capture?.("series-result");
			return;
		}

		await expect(
			page.getByText(`Ganador del mapa ${game}`, { exact: true }),
		).toBeVisible();
		if (game === 1) await capture?.("game-result");
		await button("Siguiente mapa").click();
	}
	throw new Error("The Bo5 should end after one team wins three games");
}

async function makeDraftMoves(
	page: Page,
	capture?: (screen: QuickDraftScreen) => Promise<void>,
) {
	const availableChampion = page
		.getByRole("group", { name: "Campeones", exact: true })
		.getByRole("button", { disabled: false })
		.first();
	const choose = page.getByRole("heading", { name: "Elige un campeón" });
	const confirm = page.getByRole("button", {
		name: /^Confirmar (veto|elección)$/,
	});
	let bans = 0;
	for (let turn = 0; turn < 10; turn++) {
		await expect(choose).toBeVisible();
		if ((await confirm.textContent())?.trim() === "Confirmar veto") bans++;
		if (turn === 4) await capture?.("draft");
		await availableChampion.click();
		await confirm.click();
	}
	expect(bans).toBe(5);
}
