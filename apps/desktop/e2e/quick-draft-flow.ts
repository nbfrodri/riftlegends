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

export async function playQuickDraftBo5(
	app: ElectronApplication,
	page: Page,
	capture?: (screen: QuickDraftScreen) => Promise<void>,
) {
	await app.evaluate(() => {
		const { send } = riftCore;
		riftCore.send = (body) => {
			const command = JSON.parse(body);
			if (command.kind !== "series.start") return send(body);
			riftCore.send = send;
			command.payload.seed = 198;
			return send(JSON.stringify(command));
		};
	});

	const heading = (name: string) =>
		page.getByRole("heading", { level: 1, name, exact: true });
	const button = (name: string) =>
		page.getByRole("button", { name, exact: true });
	const blue = page.getByRole("radio", { name: "Lado azul", exact: true });
	const draft = heading("Draft");

	await expect(heading("Configurar serie")).toBeVisible();
	await page.getByRole("radio", { name: "Bo5" }).check({ force: true });
	// Fearless off keeps the flow short.
	await page
		.getByRole("radio", { name: "Sin", exact: true })
		.check({ force: true });
	await expect(page.getByRole("radio", { name: "Apagado" })).toBeChecked();
	await capture?.("setup");
	await button("Empezar serie").click();

	const wins = { Forge: 0, Shoal: 0 };
	for (let game = 1; game <= 5; game++) {
		if (game === 1) {
			await expect(heading("Elección de lado")).toBeVisible();
			await expect(blue).toBeVisible();
			await capture?.("side-choice");
		}
		// When the rival chooses, the board opens automatically.
		await expect(blue.or(draft)).toBeVisible();
		if (await blue.isVisible()) {
			await blue.check({ force: true });
			await button("Ir al draft").click();
		}

		await expect(draft).toBeVisible();
		await makeDraftMoves(page, game === 1 ? capture : undefined);

		await expect(heading("Roles")).toBeVisible();
		await expect(page.getByRole("combobox")).toHaveCount(5);
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
			await expect(
				page
					.getByText(`${wins.Forge} – ${wins.Shoal}`, { exact: true })
					.first(),
			).toBeVisible();
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
