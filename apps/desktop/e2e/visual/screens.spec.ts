import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";

test.skip(
	process.platform !== "linux",
	"Baselines are only valid on the Linux CI image (font rasterisation)",
);

test.use({ systemLocale: "es-ES" });

const size = { width: 1366, height: 768 };

test.beforeEach(async ({ electronApp, appWindow }) => {
	await electronApp.evaluate(({ BrowserWindow }, { width, height }) => {
		BrowserWindow.getAllWindows()[0]?.setContentSize(width, height);
	}, size);
	await expect
		.poll(() => appWindow.evaluate(() => [innerWidth, innerHeight]))
		.toEqual([size.width, size.height]);
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
	await expect(appWindow).toHaveScreenshot("draft-collapsed.png");
});

test("Mercado with the sidebar expanded", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Mercado");
	await expect(
		appWindow.getByRole("table", { name: "Jugadores disponibles" }),
	).toBeVisible();
	await expect(appWindow).toHaveScreenshot("mercado-expanded.png");
});

test("Ajustes", async ({ appWindow }) => {
	await expandSidebar(appWindow);
	await goTo(appWindow, "Ajustes");
	await expect(appWindow).toHaveScreenshot("ajustes.png");
});
