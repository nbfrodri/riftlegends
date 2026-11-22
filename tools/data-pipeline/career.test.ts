import { expect, test } from "vitest";
import { PLAYER_ATTRIBUTES } from "../../packages/contracts/draft/player-attributes.ts";
import { playerLevel } from "./attributes.ts";
import {
	careerLevelShare,
	careerStrength,
	levelCeiling,
	type Season,
} from "./career.ts";

const season = (year: number, fields: Partial<Season> = {}): Season => ({
	year,
	games: 80,
	internationalEvents: 0,
	titles: 0,
	internationalTitles: 0,
	...fields,
});
const years = (from: number, to: number, fields: Partial<Season> = {}) =>
	Array.from({ length: to - from + 1 }, (_, i) => season(from + i, fields));

test("no history means no career", () => {
	expect(careerStrength([], 2026)).toBe(0);
	expect(careerStrength([season(2025, { games: 0 })], 2026)).toBe(0);
});

test("a long decorated career is strong but never reaches 1", () => {
	const veteran = years(2019, 2025, {
		internationalEvents: 2,
		titles: 1,
		internationalTitles: 0,
	});
	const legend = years(2019, 2025, {
		internationalEvents: 2,
		titles: 1,
		internationalTitles: 1,
	});
	const some = careerStrength(veteran, 2026);
	const more = careerStrength(legend, 2026);
	expect(some).toBeGreaterThan(0.6);
	expect(more).toBeGreaterThan(some);
	expect(more).toBeLessThan(1);
});

test("each ingredient raises the score", () => {
	const base = careerStrength([season(2025, { games: 30 })], 2026);
	for (const extra of [
		{ games: 60 },
		{ internationalEvents: 1 },
		{ titles: 1 },
		{ internationalTitles: 1 },
	])
		expect(
			careerStrength([season(2025, { games: 30, ...extra })], 2026),
		).toBeGreaterThan(base);
});

test("recent seasons weigh more than old ones", () => {
	const recent = careerStrength([season(2025, { titles: 1 })], 2026);
	const old = careerStrength([season(2019, { titles: 1 })], 2026);
	expect(recent).toBeGreaterThan(old);
	expect(old).toBeGreaterThan(0);
});

test("the window moves with the season", () => {
	const seasons = [season(2025, { titles: 1 })];
	expect(careerStrength(seasons, 2027)).toBeLessThan(
		careerStrength(seasons, 2026),
	);
});

test("the level bonus closes part of the gap to the ceiling", () => {
	const flat = Object.fromEntries(
		PLAYER_ATTRIBUTES.map((key) => [key, 70]),
	) as Record<(typeof PLAYER_ATTRIBUTES)[number], number>;
	expect(playerLevel(flat, "mid", 0)).toBe(70);
	expect(playerLevel(flat, "mid", 1)).toBe(
		Math.round(70 + careerLevelShare * (levelCeiling - 70)),
	);
	expect(playerLevel(flat, "mid", 0.5)).toBeGreaterThan(70);
	expect(playerLevel(flat, "mid", 0.5)).toBeLessThan(
		playerLevel(flat, "mid", 1),
	);
	const star = { ...flat, lanes: 99, macro: 99 };
	for (const key of PLAYER_ATTRIBUTES) star[key] = 99;
	expect(playerLevel(star, "mid", 1)).toBeLessThanOrEqual(levelCeiling);
});

test("the career ignores seasons outside the history window", () => {
	expect(careerStrength([season(2018), season(2026), season(2027)], 2026)).toBe(
		0,
	);
	expect(careerStrength([season(2019)], 2026)).toBeGreaterThan(0);
});
