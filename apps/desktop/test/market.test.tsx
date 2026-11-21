import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { placeholderPlayers } from "../src/renderer/placeholder-players";
import { MarketScreen } from "../src/renderer/screens";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

const rowsOf = () =>
	within(screen.getAllByRole("rowgroup")[1] as HTMLElement).getAllByRole("row");
const cellText = (row: HTMLElement, index: number) =>
	within(row).getAllByRole("cell")[index]?.textContent ?? "";

describe("placeholder players", () => {
	test("are 36 made-up players with unique ids, names and every role", () => {
		expect(placeholderPlayers).toHaveLength(36);
		expect(new Set(placeholderPlayers.map((p) => p.id)).size).toBe(36);
		expect(new Set(placeholderPlayers.map((p) => p.name)).size).toBe(36);
		expect(new Set(placeholderPlayers.map((p) => p.role))).toEqual(
			new Set(["top", "jungle", "mid", "bot", "support"]),
		);
	});
});

describe("Mercado screen", () => {
	test("lists the 36 players under the heading, with the eight Spanish columns", async () => {
		await renderInLocale(<MarketScreen />, "es-ES");
		expect(
			screen.getByRole("heading", { level: 1, name: "Mercado" }),
		).toBeTruthy();
		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent),
		).toEqual([
			"Jugador",
			"Posición",
			"Equipo",
			"Edad",
			"Nivel",
			"Forma",
			"Fin de contrato",
			"Salario mensual",
		]);
		expect(rowsOf()).toHaveLength(36);
		expect(screen.getByRole("status").textContent).toBe("36 de 36 jugadores");
		expect(screen.getByRole("searchbox", { name: "Buscar" })).toBeTruthy();
	});

	test("labels the table in English too", async () => {
		await renderInLocale(<MarketScreen />, "en-US");
		expect(
			screen.getByRole("heading", { level: 1, name: "Market" }),
		).toBeTruthy();
		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent),
		).toEqual([
			"Player",
			"Role",
			"Team",
			"Age",
			"Rating",
			"Form",
			"Contract end",
			"Monthly salary",
		]);
		expect(screen.getByRole("status").textContent).toBe("36 of 36 players");
	});

	test.each([
		["es-ES", "Jungla"],
		["en-US", "Jungle"],
	] as const)(
		"shows a decorative icon beside the role in %s",
		async (locale, role) => {
			await renderInLocale(<MarketScreen />, locale);
			const cell = screen.getAllByRole("cell", { name: role })[0];
			expect(cell?.textContent).toBe(role);
			expect(cell?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
				"true",
			);
			expect(
				screen.getAllByRole("cell", { name: "ADC" }).length,
			).toBeGreaterThan(0);
		},
	);

	test("formats salary, form and contract end with Intl for the language", async () => {
		await renderInLocale(<MarketScreen />, "es-ES");
		const nadir = screen.getByRole("row", { name: /^Nadir\b/ });
		expect(cellText(nadir, 1)).toBe("Mid");
		expect(cellText(nadir, 5)).toBe("+4");
		expect(cellText(nadir, 6)).toBe("jun 2027");
		// Spanish skips the thousands separator on four digits unless forced.
		expect(cellText(nadir, 7)).toBe("4.500 €");
		cleanup();

		await renderInLocale(<MarketScreen />, "en-US");
		const row = screen.getByRole("row", { name: /^Nadir\b/ });
		expect(cellText(row, 1)).toBe("Mid");
		expect(cellText(row, 6)).toBe("Jun 2027");
		expect(cellText(row, 7)).toBe("€4,500");
	});

	test("sorts by salary from the keyboard", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "en-US");
		const salary = screen.getByRole("columnheader", {
			name: "Monthly salary",
		});
		within(salary).getByRole("button").focus();
		await user.keyboard("{Enter}");
		expect(salary.getAttribute("aria-sort")).toBe("ascending");
		const ascending = [...placeholderPlayers]
			.sort((a, b) => a.salary - b.salary)
			.map((p) => p.name);
		expect(rowsOf().map((row) => cellText(row, 0))).toEqual(ascending);
		await user.keyboard("{Enter}");
		expect(rowsOf().map((row) => cellText(row, 0))).toEqual(
			[...placeholderPlayers]
				.sort((a, b) => b.salary - a.salary)
				.map((p) => p.name),
		);
	});

	test("filters by the translated role and shows the empty state", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "es-ES");
		const filter = screen.getByRole("searchbox", { name: "Buscar" });
		await user.type(filter, "support");
		const supports = placeholderPlayers.filter((p) => p.role === "support");
		expect(rowsOf()).toHaveLength(supports.length);
		await user.clear(filter);
		await user.type(filter, "zzz");
		expect(
			screen.getByText("Ningún jugador coincide con el filtro."),
		).toBeTruthy();
	});
});
