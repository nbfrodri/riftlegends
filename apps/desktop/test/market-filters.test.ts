import { describe, expect, test } from "vitest";
import {
	activeFilterKeys,
	cheapSalaryMax,
	clearFilter,
	EMPTY_FILTERS,
	filterPlayers,
	isPresetOn,
	type MarketFilters,
	togglePreset,
} from "../src/renderer/market-filters";
import {
	type PlaceholderPlayer,
	placeholderPlayers,
} from "../src/renderer/placeholder-players";

const SEASON = 2027;
const names = (players: readonly PlaceholderPlayer[]) =>
	players.map((p) => p.name);
const where = (filters: Partial<MarketFilters>) =>
	filterPlayers(placeholderPlayers, { ...EMPTY_FILTERS, ...filters }, SEASON);
const year = (p: PlaceholderPlayer) => Number(p.contractEnd.slice(0, 4));

describe("filterPlayers", () => {
	test("keeps every player with no filter", () => {
		expect(where({})).toEqual(placeholderPlayers);
	});

	test("keeps the chosen roles", () => {
		const result = where({ roles: ["top", "support"] });
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

	test("age, rating and salary ranges include both ends", () => {
		expect(where({ age: { min: 20, max: 22 } })).toEqual(
			placeholderPlayers.filter((p) => p.age >= 20 && p.age <= 22),
		);
		expect(names(where({ rating: { min: 88 } }))).toEqual(["Cobalto"]);
		expect(names(where({ rating: { max: 64 } }))).toEqual(["Faro"]);
		expect(names(where({ salary: { max: 3100 } }))).toEqual([
			"Ónix",
			"Fénix",
			"Faro",
		]);
		expect(names(where({ salary: { min: 17500 } }))).toEqual([
			"Cobalto",
			"Orión",
		]);
	});

	test("keeps players whose form is rising", () => {
		const result = where({ form: "up" });
		expect(result.length).toBeGreaterThan(0);
		expect(result).toEqual(placeholderPlayers.filter((p) => p.form > 0));
	});

	test("keeps contracts that end this season (or earlier) or the next one", () => {
		expect(where({ contract: "thisYear" })).toEqual(
			placeholderPlayers.filter((p) => year(p) <= SEASON),
		);
		expect(where({ contract: "nextYear" })).toEqual(
			placeholderPlayers.filter((p) => year(p) === SEASON + 1),
		);
	});

	test("combines filters", () => {
		expect(
			names(where({ roles: ["mid"], age: { max: 21 }, salary: { max: 5000 } })),
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
			form: "up",
			contract: "nextYear",
			salary: { max: 20000 },
		};
		const runs = Array.from({ length: 5 }, () => {
			const start = performance.now();
			[...filterPlayers(many, filters, SEASON)].sort(
				(a, b) => a.salary - b.salary,
			);
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
				salary: { max: 9000 },
				roles: ["mid"],
				age: { min: 20 },
				contract: "thisYear",
			}),
		).toEqual(["roles", "age", "contract", "salary"]);
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

describe("presets", () => {
	const context = { cheapMax: cheapSalaryMax(placeholderPlayers) };

	test("the cheap threshold is the top of the lowest salary third", () => {
		expect(
			placeholderPlayers.filter((p) => p.salary <= context.cheapMax),
		).toHaveLength(12);
		expect(cheapSalaryMax([])).toBe(0);
	});

	test.each([
		["young", { age: { max: 21 } }],
		["top", { rating: { min: 80 } }],
		["inForm", { form: "up" }],
		["expiring", { contract: "thisYear" }],
		["cheap", { salary: { max: 6400 } }],
	] as const)("%s sets its underlying filter", (preset, patch) => {
		const on = togglePreset(EMPTY_FILTERS, preset, context);
		expect(on).toEqual({ ...EMPTY_FILTERS, ...patch });
		expect(isPresetOn(on, preset, context)).toBe(true);
		expect(isPresetOn(EMPTY_FILTERS, preset, context)).toBe(false);
	});

	test("presets combine, keep the other end of a range, and a second click removes one", () => {
		let filters: MarketFilters = { ...EMPTY_FILTERS, age: { min: 19 } };
		filters = togglePreset(filters, "young", context);
		filters = togglePreset(filters, "top", context);
		expect(filters.age).toEqual({ min: 19, max: 21 });
		expect(filters.rating).toEqual({ min: 80 });
		filters = togglePreset(filters, "young", context);
		expect(filters.age).toEqual({ min: 19 });
		expect(isPresetOn(filters, "young", context)).toBe(false);
		expect(isPresetOn(filters, "top", context)).toBe(true);
	});

	test("a preset is off once its section no longer matches it", () => {
		const filters = togglePreset(EMPTY_FILTERS, "young", context);
		expect(isPresetOn({ ...filters, age: { max: 22 } }, "young", context)).toBe(
			false,
		);
	});
});
