import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const sidebar = (page: Page) =>
	page.getByRole("complementary", { name: "Sidebar" });
const sections = (page: Page) =>
	page.getByRole("navigation", { name: "Club sections" });
const sidebarToggle = (page: Page) =>
	page.getByRole("button", { name: /^(collapse|expand)$/i });
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const sidebarWidth = (page: Page) => () =>
	sidebar(page).evaluate((element) => element.getBoundingClientRect().width);

test("follows the system language", async ({ appWindow }) => {
	await expect(appWindow.locator("html")).toHaveAttribute("lang", "en");
	await expect(
		sections(appWindow).getByRole("button", { name: "Market" }),
	).toBeVisible();
});

test.describe("with a Spanish system", () => {
	test.use({ systemLocale: "es-ES" });

	test("labels the shell and the title bar in Spanish", async ({
		appWindow,
	}) => {
		await expect(appWindow.locator("html")).toHaveAttribute("lang", "es");
		const nav = appWindow.getByRole("navigation", {
			name: "Secciones del club",
		});
		await expect(nav.getByRole("button", { name: "Mercado" })).toBeVisible();
		await expect(
			appWindow.getByRole("banner").getByRole("button", { name: "Cerrar" }),
		).toBeVisible();
	});
});

test("T6: Alt+B toggles the sidebar and Draft collapses it", async ({
	appWindow,
}) => {
	const toggle = sidebarToggle(appWindow);
	// The app opens on Draft, which starts collapsed.
	await expect(heading(appWindow)).toHaveText("Set up series");
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect.poll(sidebarWidth(appWindow)).toBe(58);

	await appWindow.keyboard.press("Alt+B");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect.poll(sidebarWidth(appWindow)).toBe(196);

	await sections(appWindow).getByRole("button", { name: "Market" }).click();
	await expect(heading(appWindow)).toHaveText("Market");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");

	await sections(appWindow).getByRole("button", { name: "Draft" }).click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect.poll(sidebarWidth(appWindow)).toBe(58);

	await appWindow.keyboard.press("Alt+B");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect.poll(sidebarWidth(appWindow)).toBe(196);
});

test("T6: arrow keys move a visible focus between sections", async ({
	appWindow,
}) => {
	const nav = sections(appWindow);
	await nav.getByRole("button", { name: "Draft" }).focus();
	await appWindow.keyboard.press("ArrowDown");
	const market = nav.getByRole("button", { name: "Market" });
	await expect(nav.getByRole("button", { name: "Champions" })).toBeFocused();
	await appWindow.keyboard.press("ArrowDown");
	await expect(market).toBeFocused();
	await expect(market).toHaveCSS("outline-style", "solid");
	// The used width snaps to device pixels (2.4px at a 0.8 scale), so only
	// check that the ring is there.
	expect(
		await market.evaluate((element) =>
			Number.parseFloat(getComputedStyle(element).outlineWidth),
		),
	).toBeGreaterThanOrEqual(2);
	await appWindow.keyboard.press("Enter");
	await expect(heading(appWindow)).toHaveText("Market");
});

test("T7: navigating keeps the window location unchanged", async ({
	appWindow,
}) => {
	await expect(heading(appWindow)).toHaveText("Set up series");
	const initial = await appWindow.evaluate(() => location.href);
	// The E2E test seam may add its query (`?content=fictional`).
	expect(initial).toMatch(/^file:.*index\.html(\?[^#]*)?$/);
	const initialLength = await appWindow.evaluate(() => history.length);
	for (const [name, title] of [
		["Market", "Market"],
		["Settings", "Settings"],
		["Draft", "Set up series"],
	] as const) {
		await sections(appWindow).getByRole("button", { name }).click();
		await expect(heading(appWindow)).toHaveText(title);
		expect(await appWindow.evaluate(() => location.href)).toBe(initial);
	}
	expect(await appWindow.evaluate(() => history.length)).toBe(initialLength);
});

test("T11: the sidebar animates its width only without reduced motion", async ({
	appWindow,
}) => {
	const aside = sidebar(appWindow);
	await appWindow.emulateMedia({ reducedMotion: "no-preference" });
	await expect(aside).not.toHaveCSS("transition-duration", "0s");
	await appWindow.emulateMedia({ reducedMotion: "reduce" });
	await expect(aside).toHaveCSS("transition-duration", "0s");
});
