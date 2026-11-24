import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { createAppRouter } from "../src/renderer/router";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

const sectionsEs = [
	"Inicio",
	"Calendario",
	"Draft",
	"Campeones",
	"Plantilla",
	"Mercado",
	"Scouting",
	"Entrenamiento",
	"Competición",
	"Noticias",
	"Historial",
	"Ajustes",
];
const pendingEs = sectionsEs.filter(
	(name) => !["Draft", "Campeones", "Mercado", "Ajustes"].includes(name),
);

async function renderShell(path = "/mercado", locale = "es-ES") {
	const router = createAppRouter(path);
	await renderWithDraftCore(
		<AssetsProvider api={fakeAssets().api}>
			<RouterProvider router={router} />
		</AssetsProvider>,
		locale,
	);
	await screen.findByRole("heading", { level: 1 });
	return { router, user: userEvent.setup() };
}

const sections = () => screen.getByRole("navigation", { name: /secciones/i });
const section = (name: string) =>
	within(sections()).getByRole("button", { name });
const heading = () => screen.getByRole("heading", { level: 1 });
const toggle = () =>
	screen.getByRole("button", { name: /^(contraer|expandir)$/i });

describe("T5: sidebar sections", () => {
	test("lists the sections in order, with Ajustes last", async () => {
		await renderShell();
		expect(
			within(sections())
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label")),
		).toEqual(sectionsEs);
	});

	// #399: Draft and Campeones looked alike at 16 px (BookOpen and Columns2).
	test("every section has its own icon; Campeones uses swords", async () => {
		await renderShell();
		const iconOf = (name: string) =>
			[...(section(name).querySelector("svg")?.classList ?? [])].find((name) =>
				name.startsWith("lucide-"),
			);
		const icons = sectionsEs.map(iconOf);
		expect(new Set(icons).size).toBe(sectionsEs.length);
		expect(iconOf("Campeones")).toBe("lucide-swords");
	});

	// The Draft screen is titled after its current stage (plan 09).
	test.each([
		["Draft", "Configurar serie", "/draft"],
		["Campeones", "Campeones", "/campeones"],
		["Mercado", "Mercado", "/mercado"],
		["Ajustes", "Ajustes", "/ajustes"],
	])(
		"%s opens its screen and is marked as current",
		async (name, title, path) => {
			const { router, user } = await renderShell("/mercado");
			await user.click(section(name === "Mercado" ? "Ajustes" : "Mercado"));
			await user.click(section(name));
			await waitFor(() => expect(heading().textContent).toBe(title));
			expect(router.state.location.pathname).toBe(path);
			expect(section(name).getAttribute("aria-current")).toBe("page");
			const others = within(sections())
				.getAllByRole("button")
				.filter((button) => button !== section(name));
			for (const other of others) {
				expect(other.getAttribute("aria-current")).toBeNull();
			}
		},
	);

	test("pending sections are disabled and described as coming soon", async () => {
		const { router, user } = await renderShell("/mercado");
		for (const name of pendingEs) {
			const button = within(sections()).getByRole("button", {
				name,
				description: "Próximamente",
			});
			expect(button.getAttribute("aria-disabled")).toBe("true");
			await user.click(button);
		}
		expect(router.state.location.pathname).toBe("/mercado");
		expect(heading().textContent).toBe("Mercado");
	});

	test("available sections are not described as coming soon", async () => {
		await renderShell();
		for (const name of ["Draft", "Campeones", "Mercado", "Ajustes"]) {
			expect(section(name).getAttribute("aria-disabled")).toBeNull();
			expect(
				within(sections()).queryByRole("button", {
					name,
					description: "Próximamente",
				}),
			).toBeNull();
		}
	});

	test("follows the system language", async () => {
		await renderShell("/mercado", "en-US");
		const nav = screen.getByRole("navigation", { name: "Club sections" });
		expect(
			within(nav)
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label")),
		).toEqual([
			"Home",
			"Calendar",
			"Draft",
			"Champions",
			"Roster",
			"Market",
			"Scouting",
			"Training",
			"Competition",
			"News",
			"History",
			"Settings",
		]);
		expect(
			within(nav).getByRole("button", {
				name: "Calendar",
				description: "Coming soon",
			}),
		).toBeTruthy();
		expect(heading().textContent).toBe("Market");
		expect(screen.getByRole("button", { name: "Collapse" })).toBeTruthy();
	});

	test("shows the placeholder club and its season date", async () => {
		await renderShell();
		const sidebar = screen.getByRole("complementary", {
			name: "Barra lateral",
		});
		expect(within(sidebar).getByText("Bruma")).toBeTruthy();
		const date = within(sidebar).getByText("18 jun 2027");
		expect(date.tagName).toBe("TIME");
		expect(date.getAttribute("datetime")).toBe("2027-06-18");
	});

	test("opens Draft by default", async () => {
		const { router } = await renderShell("/");
		expect(heading().textContent).toBe("Configurar serie");
		expect(router.state.location.pathname).toBe("/draft");
	});
});

describe("T6: collapsing and keyboard", () => {
	test("the toggle collapses the sidebar to icons and expands it again", async () => {
		const { user } = await renderShell("/mercado");
		expect(toggle().getAttribute("aria-expanded")).toBe("true");
		expect(toggle().getAttribute("aria-keyshortcuts")).toBe("Alt+B");
		expect(within(sections()).getByText("Plantilla")).toBeTruthy();

		await user.click(toggle());
		expect(toggle().getAttribute("aria-label")).toBe("Expandir");
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
		expect(within(sections()).queryByText("Plantilla")).toBeNull();
		// Collapsed items keep their accessible names.
		expect(section("Plantilla")).toBeTruthy();

		await user.click(toggle());
		expect(toggle().getAttribute("aria-label")).toBe("Contraer");
		expect(within(sections()).getByText("Plantilla")).toBeTruthy();
	});

	test("Alt+B toggles the sidebar; other chords do not", async () => {
		const { user } = await renderShell("/mercado");
		await user.keyboard("{Alt>}b{/Alt}");
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
		await user.keyboard("{Control>}{Alt>}b{/Alt}{/Control}");
		await user.keyboard("b");
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
		await user.keyboard("{Alt>}B{/Alt}");
		expect(toggle().getAttribute("aria-expanded")).toBe("true");
	});

	test("collapsed sections show their label in a tooltip", async () => {
		const { user } = await renderShell("/mercado");
		await user.click(toggle());
		await user.hover(section("Ajustes"));
		expect(await screen.findByText("Ajustes")).toBeTruthy();
		await user.unhover(section("Ajustes"));
		await user.hover(section("Calendario"));
		const label = await screen.findByText("Calendario");
		expect(label.parentElement?.textContent).toContain("Próximamente");
	});

	test("arrow keys, Home and End move between available sections; Enter opens", async () => {
		const { user } = await renderShell("/mercado");
		section("Mercado").focus();
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(section("Ajustes"));
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(section("Draft"));
		await user.keyboard("{ArrowUp}");
		expect(document.activeElement).toBe(section("Ajustes"));
		await user.keyboard("{Home}");
		expect(document.activeElement).toBe(section("Draft"));
		await user.keyboard("{End}");
		expect(document.activeElement).toBe(section("Ajustes"));
		await user.keyboard("{Enter}");
		await waitFor(() => expect(heading().textContent).toBe("Ajustes"));
	});

	test("Tab skips the pending sections", async () => {
		const { user } = await renderShell("/mercado");
		section("Draft").focus();
		await user.tab();
		expect(document.activeElement).toBe(section("Campeones"));
		await user.tab();
		expect(document.activeElement).toBe(section("Mercado"));
		await user.tab();
		expect(document.activeElement).toBe(section("Ajustes"));
	});

	test("entering Draft collapses the sidebar, which can be expanded again", async () => {
		const { user } = await renderShell("/mercado");
		expect(toggle().getAttribute("aria-expanded")).toBe("true");

		await user.click(section("Draft"));
		await waitFor(() => expect(heading().textContent).toBe("Configurar serie"));
		expect(toggle().getAttribute("aria-expanded")).toBe("false");

		await user.keyboard("{Alt>}b{/Alt}");
		expect(toggle().getAttribute("aria-expanded")).toBe("true");

		// Leaving Draft restores the width chosen for the other screens.
		await user.click(section("Ajustes"));
		await waitFor(() => expect(heading().textContent).toBe("Ajustes"));
		expect(toggle().getAttribute("aria-expanded")).toBe("true");
		await user.click(toggle());

		// Every entry into Draft collapses it again.
		await user.click(section("Draft"));
		await waitFor(() => expect(heading().textContent).toBe("Configurar serie"));
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
		await user.click(toggle());
		await user.click(section("Mercado"));
		await waitFor(() => expect(heading().textContent).toBe("Mercado"));
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
	});
});

describe("T11: reduced motion", () => {
	test("the shell animates only when the user allows motion", async () => {
		const { user } = await renderShell("/mercado");
		await user.click(toggle());
		const shell = screen.getByRole("complementary", {
			name: "Barra lateral",
		}).parentElement;
		const animated = [...(shell?.querySelectorAll("[class]") ?? [])].flatMap(
			(element) =>
				[...element.classList].filter((name) =>
					/(^|:)(transition|duration|ease|animate)/.test(name),
				),
		);
		expect(animated.length).toBeGreaterThan(0);
		for (const name of animated) expect(name).toMatch(/^motion-safe:/);
	});
});
