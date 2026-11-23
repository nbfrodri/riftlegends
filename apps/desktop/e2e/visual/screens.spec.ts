import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { playQuickDraftBo5 } from "../quick-draft-flow";
import { captureScreen } from "./capture";

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
	await captureScreen(appWindow, "sidebar-tooltip.png");
});

test("Mercado with the sidebar expanded", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Mercado");
	await expect(
		appWindow.getByRole("table", { name: "Jugadores disponibles" }),
	).toBeVisible();
	await captureScreen(appWindow, "mercado-expanded.png");
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

test.describe("Quick draft", () => {
	test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

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
			// Reduced motion starts the replay at its final frame. Re-enable
			// motion before playing so the shared flow can use Skip to end.
			if (screen === "game-plan") {
				await appWindow.emulateMedia({ reducedMotion: "no-preference" });
			}
		});
	});
});
