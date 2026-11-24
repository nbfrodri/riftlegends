import type { Role } from "@rift-legends/contracts";
import type { PlaceholderPlayer } from "./placeholder-players";

// Market filters (#385) over the fields the market rows have today. They all
// combine: a player must pass every filter in use.

/** Both ends included; a missing end is open. */
export type Range = { min?: number; max?: number };

export type MarketFilters = {
	/** Empty means every role. */
	roles: readonly Role[];
	team: string | null;
	age: Range;
	rating: Range;
	/** Contracts that end in this year or before. */
	contractUntil: number | null;
	maxSalary: number | null;
};

export type FilterKey = keyof MarketFilters;

export const EMPTY_FILTERS: MarketFilters = {
	roles: [],
	team: null,
	age: {},
	rating: {},
	contractUntil: null,
	maxSalary: null,
};

const ORDER = Object.keys(EMPTY_FILTERS) as FilterKey[];

const inRange = (value: number, { min, max }: Range) =>
	(min === undefined || value >= min) && (max === undefined || value <= max);

export const contractYear = (player: PlaceholderPlayer) =>
	Number(player.contractEnd.slice(0, 4));

export function filterPlayers(
	players: readonly PlaceholderPlayer[],
	filters: MarketFilters,
): readonly PlaceholderPlayer[] {
	if (activeFilterKeys(filters).length === 0) return players;
	const roles = new Set(filters.roles);
	return players.filter(
		(player) =>
			(roles.size === 0 || roles.has(player.role)) &&
			(filters.team === null || player.team === filters.team) &&
			inRange(player.age, filters.age) &&
			inRange(player.rating, filters.rating) &&
			(filters.contractUntil === null ||
				contractYear(player) <= filters.contractUntil) &&
			(filters.maxSalary === null || player.salary <= filters.maxSalary),
	);
}

const isActive = (value: MarketFilters[FilterKey]) =>
	Array.isArray(value)
		? value.length > 0
		: typeof value === "object" && value !== null
			? Object.values(value).some((end) => end !== undefined)
			: value !== null;

/** The filters in use, in the order of the filter bar. */
export const activeFilterKeys = (filters: MarketFilters) =>
	ORDER.filter((key) => isActive(filters[key]));

export const clearFilter = (
	filters: MarketFilters,
	key: FilterKey,
): MarketFilters => ({ ...filters, [key]: EMPTY_FILTERS[key] });
