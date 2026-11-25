import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { playQuickDraftBo5, seedNextSeries } from "../quick-draft-flow";
import { captureHovered, captureScreen } from "./capture";

test.skip(
	process.platform !== "linux",
	"Baselines are only valid on the Linux CI image (font rasterisation)",
);

test.use({ systemLocale: "es-ES" });

test.beforeEach(async ({ appWindow }) => {
	await appWindow.setViewportSize({ width: 1366, height: 768 });
	await expect(appWindow.getByRole("heading", { level: 1 })).toHaveText(
		"Configurar serie",
	);
});

const goTo = async (page: Page, section: string) => {
	await page
		.getByRole("navigation", { name: "Secciones del club" })
		.getByRole("button", { name: section })
		.click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(section);
};

const expandSidebar = async (page: Page) => {
	await page.keyboard.press("Alt+B");
	await expect(
		page.getByRole("button", { name: /^(contraer|expandir)$/i }),
	).toHaveAttribute("aria-expanded", "true");
};

test("Draft with the sidebar collapsed", async ({ appWindow }) => {
	await captureScreen(appWindow, "draft-collapsed.png");
});

test("Collapsed sidebar with the Caja tooltip and its shortcut", async ({
	appWindow,
}) => {
	await appWindow.emulateMedia({ reducedMotion: "reduce" });
	await appWindow.getByRole("button", { name: "Expandir" }).hover();
	await expect(appWindow.getByRole("tooltip")).toContainText("Alt+B");
	await captureHovered(appWindow, "sidebar-tooltip.png");
});

test("Mercado with the sidebar expanded", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Mercado");
	await expect(
		appWindow.getByRole("table", { name: "Jugadores disponibles" }),
	).toBeVisible();
	await captureScreen(appWindow, "mercado-expanded.png");
});

const filterDatabase = async (page: Page) => {
	await goTo(page, "Base de datos");
	const panel = page.getByRole("complementary", { name: "Filtros" });
	await panel
		.getByRole("group", { name: "Posición" })
		.getByRole("button", { name: "Mid" })
		.click();
	await expect(
		page.getByRole("list", { name: "Filtros activos" }),
	).toBeVisible();
	await page.mouse.move(0, 0);
};

test("Base de datos: players with the filter panel", async ({ appWindow }) => {
	await filterDatabase(appWindow);
	await captureScreen(appWindow, "base-de-datos-jugadores.png");
});

test("Base de datos: player card", async ({ appWindow }) => {
	await appWindow.emulateMedia({ reducedMotion: "reduce" });
	await filterDatabase(appWindow);
	await appWindow.getByRole("row", { name: /Kilnara/ }).click();
	await expect(
		appWindow.getByRole("dialog", { name: "Ficha de jugador: Kilnara" }),
	).toBeVisible();
	await captureScreen(appWindow, "base-de-datos-ficha.png");
});

test("Base de datos: teams", async ({ appWindow }) => {
	await goTo(appWindow, "Base de datos");
	await appWindow
		.getByRole("radiogroup", { name: "Sección" })
		.getByText("Equipos")
		.click();
	await expect(
		appWindow.getByRole("list", { name: "Todos los equipos" }),
	).toBeVisible();
	await appWindow.mouse.move(0, 0);
	await captureScreen(appWindow, "base-de-datos-equipos.png");
});

const filterMarket = async (page: Page) => {
	await goTo(page, "Mercado");
	const panel = page.getByRole("complementary", { name: "Filtros" });
	await panel
		.getByRole("group", { name: "Posición" })
		.getByRole("button", { name: "Mid" })
		.click();
	await panel.getByRole("button", { name: "Jóvenes" }).click();
	await expect(
		page.getByRole("list", { name: "Filtros activos" }),
	).toBeVisible();
	await page.mouse.move(0, 0);
};

test("Mercado with the filter panel, a preset and the color scale", async ({
	appWindow,
}) => {
	await filterMarket(appWindow);
	await captureScreen(appWindow, "mercado-filters.png");
});

test("Mercado filters fit the minimum window", async ({ appWindow }) => {
	await appWindow.setViewportSize({ width: 1280, height: 720 });
	await filterMarket(appWindow);
	await captureScreen(appWindow, "mercado-filters-1280.png");
});

test.describe("Campeones", () => {
	test.use({ appEnv: { RIFT_E2E_CONTENT: "fictional" } });

	test("Campeones with the Top tier list", async ({ appWindow }) => {
		await goTo(appWindow, "Campeones");
		await expect(
			appWindow.getByRole("button", { name: "Cragbell" }),
		).toBeVisible();
		await appWindow.mouse.move(0, 0);
		await captureScreen(appWindow, "campeones-top.png");
	});

	test("Campeones with the full list", async ({ appWindow }) => {
		await goTo(appWindow, "Campeones");
		await appWindow
			.getByRole("radiogroup", { name: "Vista" })
			.getByText("Lista completa")
			.click();
		await expect(
			appWindow
				.getByRole("list", { name: "Todos los campeones" })
				.getByRole("button", { name: "Cragbell" }),
		).toBeVisible();
		await appWindow.mouse.move(0, 0);
		await captureScreen(appWindow, "campeones-lista.png");
	});

	test("Campeones with a champion's detail open", async ({ appWindow }) => {
		await goTo(appWindow, "Campeones");
		await appWindow.getByRole("button", { name: "Rimefoil" }).click();
		const detail = appWindow.getByRole("region", {
			name: "Ficha de campeón: Rimefoil",
		});
		await expect(
			detail.getByRole("region", { name: "Aporta a composiciones de" }),
		).toBeVisible();
		await expect(
			detail.getByRole("region", { name: "Pierde contra" }),
		).toContainText("Brassburrow");
		await appWindow.mouse.move(0, 0);
		await captureScreen(appWindow, "campeones-detalle.png");
	});
});

test("Ajustes", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Ajustes");
	// Offline E2E: the startup sync settles on "not downloaded".
	const content = appWindow.getByRole("region", { name: "Contenido" });
	await expect(content.getByText(/^Sin descargar\./)).toBeVisible();
	await captureScreen(appWindow, "ajustes.png");
	await captureScreen(appWindow, "ajustes-contenido.png", content);
});

test("Créditos", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Ajustes");
	await appWindow.getByRole("link", { name: "Ver créditos" }).click();
	await expect(appWindow.getByRole("heading", { level: 1 })).toHaveText(
		"Créditos",
	);
	await expect(
		appWindow.getByRole("region", { name: "Aviso legal" }),
	).toContainText("isn't endorsed by Riot Games");
	await appWindow.mouse.move(0, 0);
	await captureScreen(appWindow, "creditos.png");
});

test.describe("Quick draft", () => {
	test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

	test("#419: the turn timer as a bar on the draft board", async ({
		electronApp,
		appWindow,
	}) => {
		await appWindow.emulateMedia({ reducedMotion: "reduce" });
		await seedNextSeries(electronApp, 198);
		await appWindow.getByRole("radio", { name: "Activado" }).check({
			force: true,
		});
		await appWindow.getByRole("button", { name: "Empezar serie" }).click();
		// Wait for the side screen: the setup has radio groups of its own.
		await expect(
			appWindow.getByRole("heading", { level: 1, name: "Lado y orden" }),
		).toBeVisible();
		const choices = appWindow.getByRole("radiogroup").getByRole("radio");
		await expect(choices.first()).toBeVisible();
		await choices.last().check({ force: true });
		await appWindow.getByRole("button", { name: "Confirmar decisión" }).click();
		// Freeze the clock the countdown reads so the bar stays full (30 s left).
		await appWindow.evaluate(() => {
			const now = performance.now();
			performance.now = () => now;
		});
		await appWindow.getByRole("button", { name: "Ir al draft" }).click();
		await expect(appWindow.getByRole("timer")).toContainText("00:30");
		await appWindow.mouse.move(0, 0);
		await captureScreen(appWindow, "quick-draft-timer.png");
	});

	test("E2: captures the screens of a seeded Bo5", async ({
		electronApp,
		appWindow,
	}) => {
		// A whole Bo5 with the AI pauses takes over a minute; leave room for slow CI.
		test.setTimeout(240_000);
		await appWindow.emulateMedia({ reducedMotion: "reduce" });
		await playQuickDraftBo5(electronApp, appWindow, async (screen) => {
			if (screen === "game-result") {
				// Wait for the series summary to populate all five roles.
				const gaps = appWindow.getByRole("table", {
					name: "Diferencias por rol",
				});
				await expect(gaps.getByRole("row")).toHaveCount(6);
			}
			// The draft timer is off, and the match clock stops at the final frame.
			await appWindow.mouse.move(0, 0);
			await captureScreen(appWindow, `quick-draft-${screen}.png`);
			if (screen === "draft") {
				const tile = appWindow
					.getByRole("group", { name: "Campeones", exact: true })
					.getByRole("button", { name: /^Rimefoil/ });
				await tile.focus();
				await appWindow.keyboard.press("i");
				const card = appWindow.getByRole("region", {
					name: "Ficha de campeón: Rimefoil",
				});
				await expect(
					card.getByRole("heading", { name: "Pierde contra" }),
				).toBeVisible();
				await captureScreen(appWindow, "quick-draft-champion-card.png");
				await appWindow.keyboard.press("Escape");
				// Tidewren sits on either side depending on the seeded side choice.
				await appWindow
					.getByRole("region", { name: /^Lado (azul|rojo)/ })
					.getByRole("button", { name: /Tidewren/ })
					.click();
				const playerCard = appWindow.getByRole("group", {
					name: /Ficha de jugador/,
				});
				const wasOpen = await playerCard.evaluate(
					(element) => (element as HTMLDetailsElement).open,
				);
				if (!wasOpen) await playerCard.locator("summary").click();
				await expect(playerCard.getByText("Mecánicas")).toBeVisible();
				await appWindow.mouse.move(0, 0);
				// The whole window: the open card drops over the board (#430).
				await captureScreen(appWindow, "quick-draft-player-card.png");
				if (!wasOpen) await playerCard.locator("summary").click();
				// #407: the AI read, latest decision first, dropping over the board.
				// Selecting the player opens the card; close it so only the AI read shows.
				if (await playerCard.evaluate((e) => (e as HTMLDetailsElement).open))
					await playerCard.locator("summary").first().click();
				const aiRead = appWindow.getByRole("group", {
					name: "Lectura de la IA",
				});
				const aiWasOpen = await aiRead.evaluate(
					(element) => (element as HTMLDetailsElement).open,
				);
				if (!aiWasOpen) await aiRead.locator("summary").first().click();
				await expect(
					aiRead.getByRole("list", { name: "Motivos" }).first(),
				).toBeVisible();
				await appWindow.mouse.move(0, 0);
				await captureScreen(appWindow, "quick-draft-ai-read.png");
				if (!aiWasOpen) await aiRead.locator("summary").first().click();
				// #435: a selected champion previews in the picking row until it is
				// confirmed; with reduced motion it is marked instead of pulsing.
				await appWindow
					.getByRole("group", { name: "Campeones", exact: true })
					.getByRole("button", { disabled: false })
					.first()
					.click();
				await expect(appWindow.locator("[data-pending]")).toContainText(
					"Eligiendo",
				);
				await appWindow.mouse.move(0, 0);
				await captureScreen(appWindow, "quick-draft-pick-preview.png");
			}
			if (screen === "match") {
				const panel = appWindow.getByRole("radiogroup", { name: "Panel" });
				await panel.getByRole("radio", { name: "Cara a cara" }).check();
				// #433: one long handle, cut without moving the pictures.
				await appWindow
					.locator("[data-lane-player] [data-part=name] > span")
					.first()
					.evaluate((handle) => {
						handle.textContent = "Averyveryveryverylonghandlethatneverends";
					});
				await appWindow.mouse.move(0, 0);
				await captureScreen(appWindow, "quick-draft-face-to-face.png");
				await panel.getByRole("radio", { name: "Mapa" }).check();
			}
			// Reduced motion starts the replay at its final frame. Re-enable
			// motion before playing so the shared flow can use Skip to end.
			if (screen === "game-plan") {
				await appWindow.emulateMedia({ reducedMotion: "no-preference" });
			}
		});
	});
});
