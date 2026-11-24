import type { Role } from "@rift-legends/contracts";
import type { PlaceholderPlayer } from "./placeholder-players";

// Market filters (#385) over the fields the market rows have today. They all
// combine: a player must pass every filter in use. Presets only set these
// filters, so the panel sections always show what a preset did.

/** Both ends included; a missing end is open. */
export type Range = { min?: number; max?: number };

/** Contracts ending this season (or already ended) or the next one. */
type ContractWindow = "thisYear" | "nextYear";

export type MarketFilters = {
	/** Empty means every role. */
	roles: readonly Role[];
	age: Range;
	rating: Range;
	form: "up" | null;
	team: string | null;
	contract: ContractWindow | null;
	salary: Range;
};

export type FilterKey = keyof MarketFilters;

export const EMPTY_FILTERS: MarketFilters = {
	roles: [],
	age: {},
	rating: {},
	form: null,
	team: null,
	contract: null,
	salary: {},
};

const ORDER = Object.keys(EMPTY_FILTERS) as FilterKey[];

const inRange = (value: number, { min, max }: Range) =>
	(min === undefined || value >= min) && (max === undefined || value <= max);

const contractYear = (player: PlaceholderPlayer) =>
	Number(player.contractEnd.slice(0, 4));

const inWindow = (year: number, window: ContractWindow, season: number) =>
	window === "thisYear" ? year <= season : year === season + 1;

export function filterPlayers(
	players: readonly PlaceholderPlayer[],
	filters: MarketFilters,
	season: number,
): readonly PlaceholderPlayer[] {
	if (activeFilterKeys(filters).length === 0) return players;
	const roles = new Set(filters.roles);
	const { team, form, contract } = filters;
	return players.filter(
		(player) =>
			(roles.size === 0 || roles.has(player.role)) &&
			inRange(player.age, filters.age) &&
			inRange(player.rating, filters.rating) &&
			(form === null || player.form > 0) &&
			(team === null || player.team === team) &&
			(contract === null || inWindow(contractYear(player), contract, season)) &&
			inRange(player.salary, filters.salary),
	);
}

const isActive = (value: MarketFilters[FilterKey]) =>
	Array.isArray(value)
		? value.length > 0
		: typeof value === "object" && value !== null
			? Object.values(value).some((end) => end !== undefined)
			: value !== null;

/** The filters in use, in the order of the panel. */
export const activeFilterKeys = (filters: MarketFilters) =>
	ORDER.filter((key) => isActive(filters[key]));

export const clearFilter = (
	filters: MarketFilters,
	key: FilterKey,
): MarketFilters => ({ ...filters, [key]: EMPTY_FILTERS[key] });

/** Sets one end of a range; `undefined` opens it. */
function withEnd(range: Range, end: keyof Range, value?: number): Range {
	const next = { ...range };
	if (value === undefined) delete next[end];
	else next[end] = value;
	return next;
}

// Presets: one click sets a filter, a second click removes it.

export const PRESETS = ["young", "top", "inForm", "expiring", "cheap"] as const;
export type Preset = (typeof PRESETS)[number];

export type PresetContext = {
	/** Highest salary of the cheapest third of the players. */
	cheapMax: number;
};

export function cheapSalaryMax(players: readonly PlaceholderPlayer[]) {
	const salaries = players.map((p) => p.salary).sort((a, b) => a - b);
	return salaries[Math.max(Math.ceil(salaries.length / 3) - 1, 0)] ?? 0;
}

const YOUNG_MAX_AGE = 21;
const TOP_MIN_RATING = 80;

type PresetRule = {
	on: (filters: MarketFilters, context: PresetContext) => boolean;
	set: (filters: MarketFilters, context: PresetContext) => MarketFilters;
	unset: (filters: MarketFilters) => MarketFilters;
};

const RULES: Record<Preset, PresetRule> = {
	young: {
		on: (f) => f.age.max === YOUNG_MAX_AGE,
		set: (f) => ({ ...f, age: withEnd(f.age, "max", YOUNG_MAX_AGE) }),
		unset: (f) => ({ ...f, age: withEnd(f.age, "max") }),
	},
	top: {
		on: (f) => f.rating.min === TOP_MIN_RATING,
		set: (f) => ({ ...f, rating: withEnd(f.rating, "min", TOP_MIN_RATING) }),
		unset: (f) => ({ ...f, rating: withEnd(f.rating, "min") }),
	},
	inForm: {
		on: (f) => f.form === "up",
		set: (f) => ({ ...f, form: "up" }),
		unset: (f) => ({ ...f, form: null }),
	},
	expiring: {
		on: (f) => f.contract === "thisYear",
		set: (f) => ({ ...f, contract: "thisYear" }),
		unset: (f) => ({ ...f, contract: null }),
	},
	cheap: {
		on: (f, c) => f.salary.max === c.cheapMax,
		set: (f, c) => ({ ...f, salary: withEnd(f.salary, "max", c.cheapMax) }),
		unset: (f) => ({ ...f, salary: withEnd(f.salary, "max") }),
	},
};

export const isPresetOn = (
	filters: MarketFilters,
	preset: Preset,
	context: PresetContext,
) => RULES[preset].on(filters, context);

export const togglePreset = (
	filters: MarketFilters,
	preset: Preset,
	context: PresetContext,
) =>
	RULES[preset].on(filters, context)
		? RULES[preset].unset(filters)
		: RULES[preset].set(filters, context);
