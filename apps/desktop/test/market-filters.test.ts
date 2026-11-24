import { describe, expect, test } from "vitest";
import {
	activeFilterKeys,
	clearFilter,
	EMPTY_FILTERS,
	filterPlayers,
	type MarketFilters,
} from "../src/renderer/market-filters";
import {
	type PlaceholderPlayer,
	placeholderPlayers,
} from "../src/renderer/placeholder-players";

const names = (players: readonly PlaceholderPlayer[]) =>
	players.map((p) => p.name);
const where = (filters: Partial<MarketFilters>) =>
	filterPlayers(placeholderPlayers, { ...EMPTY_FILTERS, ...filters });

describe("filterPlayers", () => {
	test("keeps every player with no filter", () => {
		expect(where({})).toEqual(placeholderPlayers);
	});

	test("keeps the chosen roles", () => {
		const result = where({ roles: ["top", "support"] });
		expect(result.length).toBeGreaterThan(0);
		expect(new Set(result.map((p) => p.role))).toEqual(
			new Set(["top", "support"]),
		);
		expect(result).toHaveLength(
			placeholderPlayers.filter((p) => p.role === "top" || p.role === "support")
				.length,
		);
	});

	test("keeps one team", () => {
		const result = where({ team: "Bruma" });
		expect(result.length).toBeGreaterThan(0);
		expect(result.every((p) => p.team === "Bruma")).toBe(true);
	});

	test("age and rating ranges include both ends", () => {
		const result = where({ age: { min: 20, max: 22 } });
		expect(result.map((p) => p.age).sort()).toEqual(
			placeholderPlayers
				.filter((p) => p.age >= 20 && p.age <= 22)
				.map((p) => p.age)
				.sort(),
		);
		expect(names(where({ rating: { min: 88 } }))).toEqual(["Cobalto"]);
		expect(names(where({ rating: { max: 64 } }))).toEqual(["Faro"]);
	});

	test("keeps contracts ending in or before a year", () => {
		const result = where({ contractUntil: 2026 });
		expect(names(result)).toEqual(["Dune", "Iris", "Orión", "Bruno"]);
	});

	test("keeps salaries up to the maximum", () => {
		expect(names(where({ maxSalary: 3100 }))).toEqual([
			"Ónix",
			"Fénix",
			"Faro",
		]);
	});

	test("combines filters", () => {
		expect(
			names(where({ roles: ["mid"], age: { max: 21 }, maxSalary: 5000 })),
		).toEqual(["Wren"]);
	});

	test("filters and sorts 5,000 players well inside a frame", () => {
		const many = Array.from({ length: 5000 }, (_, index) => {
			const base = placeholderPlayers[index % placeholderPlayers.length];
			return { ...(base as PlaceholderPlayer), id: `p${index}` };
		});
		const filters: MarketFilters = {
			roles: ["mid", "bot"],
			team: "Bruma",
			age: { min: 18, max: 30 },
			rating: { min: 60 },
			contractUntil: 2029,
			maxSalary: 20000,
		};
		const runs = Array.from({ length: 5 }, () => {
			const start = performance.now();
			[...filterPlayers(many, filters)].sort((a, b) => a.salary - b.salary);
			return performance.now() - start;
		}).sort((a, b) => a - b);
		// Median of five runs; a frame at 60 FPS is 16 ms.
		expect(runs[2]).toBeLessThan(16);
	});
});

describe("active filters", () => {
	test("lists only the filters in use, in a stable order", () => {
		expect(activeFilterKeys(EMPTY_FILTERS)).toEqual([]);
		expect(
			activeFilterKeys({
				...EMPTY_FILTERS,
				maxSalary: 9000,
				roles: ["mid"],
				age: { min: 20 },
			}),
		).toEqual(["roles", "age", "maxSalary"]);
	});

	test("clearing one filter leaves the others", () => {
		const filters: MarketFilters = {
			...EMPTY_FILTERS,
			team: "Duna",
			rating: { min: 70, max: 80 },
		};
		expect(clearFilter(filters, "rating")).toEqual({
			...EMPTY_FILTERS,
			team: "Duna",
		});
	});
});
