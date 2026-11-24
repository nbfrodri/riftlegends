import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { placeholderPlayers } from "../src/renderer/placeholder-players";
import { MarketScreen } from "../src/renderer/screens";
import { renderInLocale } from "./render-in-locale";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

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
		expect(cellText(nadir, 5)).toBe("4 en alza");
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

const cellOf = (name: string, index: number) =>
	within(
		screen.getByRole("row", { name: new RegExp(`^${name}\\b`) }),
	).getAllByRole("cell")[index] as HTMLElement;

describe("Mercado color scale (#384)", () => {
	test("colors form by sign and says it in words, without a sign", async () => {
		await renderInLocale(<MarketScreen />, "es-ES");
		const up = cellOf("Nadir", 5);
		expect(up.textContent).toBe("4 en alza");
		expect(up.querySelector(".text-good")).toBeTruthy();
		const down = cellOf("Vega", 5);
		expect(down.textContent).toBe("2 en baja");
		expect(down.querySelector(".text-bad")).toBeTruthy();
		const flat = cellOf("Brisa", 5);
		expect(flat.textContent).toBe("0 estable");
		expect(flat.querySelector(".text-good, .text-bad")).toBeNull();
	});

	test("colors the rating with the player card scale and reads its level", async () => {
		await renderInLocale(<MarketScreen />, "en-US");
		const high = cellOf("Cobalto", 4);
		expect(high.textContent).toBe("88 High");
		expect(high.querySelector(".text-good")).toBeTruthy();
		const mid = cellOf("Faro", 4);
		expect(mid.textContent).toBe("64 Medium");
		expect(mid.querySelector(".text-good, .text-bad")).toBeNull();
	});
});

describe("Mercado filters (#385)", () => {
	const status = () => screen.getByRole("status").textContent;
	const names = () => rowsOf().map((row) => cellText(row, 0));

	test("filters by role with the role icons and combines with the team", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "en-US");
		const mid = screen.getByRole("button", { name: "Mid" });
		await user.click(mid);
		expect(mid.getAttribute("aria-pressed")).toBe("true");
		const mids = placeholderPlayers.filter((p) => p.role === "mid");
		expect(status()).toBe(`${mids.length} of 36 players`);
		await user.click(screen.getByRole("combobox", { name: "Team" }));
		await user.click(await screen.findByRole("option", { name: "Bruma" }));
		expect(names()).toEqual(
			mids.filter((p) => p.team === "Bruma").map((p) => p.name),
		);
	});

	test("filters by age, rating, contract end and maximum salary", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "en-US");
		await user.type(
			screen.getByRole("spinbutton", { name: "Minimum age" }),
			"25",
		);
		await user.type(
			screen.getByRole("spinbutton", { name: "Maximum rating" }),
			"84",
		);
		await user.type(
			screen.getByRole("spinbutton", { name: "Maximum monthly salary" }),
			"15000",
		);
		await user.click(
			screen.getByRole("combobox", { name: "Contract ends by" }),
		);
		await user.click(await screen.findByRole("option", { name: "2027" }));
		expect(names()).toEqual(
			placeholderPlayers
				.filter(
					(p) =>
						p.age >= 25 &&
						p.rating <= 84 &&
						p.salary <= 15000 &&
						Number(p.contractEnd.slice(0, 4)) <= 2027,
				)
				.map((p) => p.name),
		);
	});

	test("shows each active filter as a chip that removes it, and clears them all", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "es-ES");
		expect(
			screen.queryByRole("button", { name: "Limpiar filtros" }),
		).toBeNull();
		await user.click(screen.getByRole("button", { name: "Top" }));
		await user.type(
			screen.getByRole("spinbutton", { name: "Edad máxima" }),
			"22",
		);
		const chips = screen.getByRole("list", { name: "Filtros activos" });
		expect(
			within(chips)
				.getAllByRole("listitem")
				.map((chip) => chip.textContent),
		).toEqual(["Posición: Top", "Edad: hasta 22"]);
		await user.click(
			within(chips).getByRole("button", {
				name: "Quitar filtro Posición: Top",
			}),
		);
		expect(
			screen.getByRole("button", { name: "Top" }).getAttribute("aria-pressed"),
		).toBe("false");
		expect(rowsOf().every((row) => Number(cellText(row, 3)) <= 22)).toBe(true);
		await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
		expect(status()).toBe("36 de 36 jugadores");
		expect(screen.queryByRole("list", { name: "Filtros activos" })).toBeNull();
		expect(
			(
				screen.getByRole("spinbutton", {
					name: "Edad máxima",
				}) as HTMLInputElement
			).value,
		).toBe("");
	});

	test("keeps sorting the filtered rows by any header", async () => {
		const user = userEvent.setup();
		await renderInLocale(<MarketScreen />, "en-US");
		await user.click(screen.getByRole("button", { name: "ADC" }));
		const age = screen.getByRole("columnheader", { name: "Age" });
		await user.click(within(age).getByRole("button"));
		await user.click(within(age).getByRole("button"));
		expect(age.getAttribute("aria-sort")).toBe("descending");
		const ages = rowsOf().map((row) => Number(cellText(row, 3)));
		expect(ages).toEqual([...ages].sort((a, b) => b - a));
		expect(rowsOf().every((row) => cellText(row, 1) === "ADC")).toBe(true);
	});

	test("with 5,000 players it filters and sorts but mounts only a window", async () => {
		// happy-dom has no layout: give the scrolling region and rows a size.
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
			function (this: HTMLElement) {
				return this.getAttribute("role") === "region" ? 600 : 0;
			},
		);
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
			function (this: HTMLElement) {
				return this.tagName === "TR" ? 24 : this.tagName === "THEAD" ? 32 : 0;
			},
		);
		const user = userEvent.setup();
		const many = Array.from({ length: 5000 }, (_, index) => ({
			...(placeholderPlayers[
				index % 36
			] as (typeof placeholderPlayers)[number]),
			id: `p${index}`,
		}));
		await renderInLocale(<MarketScreen players={many} />, "en-US");
		await user.click(screen.getByRole("button", { name: "Support" }));
		const supports = many.filter((p) => p.role === "support").length;
		expect(status()).toBe(`${supports} of 5000 players`);
		await user.click(
			within(screen.getByRole("columnheader", { name: "Rating" })).getByRole(
				"button",
			),
		);
		expect(rowsOf().length).toBeLessThan(100);
	});
});
