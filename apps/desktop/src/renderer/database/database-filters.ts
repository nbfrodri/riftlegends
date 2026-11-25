import type { ContentDatabase, Role } from "@rift-legends/contracts";
import type { Range } from "../market-filters";

// Filters of the database players (#443), in the style of the market (#385):
// they all combine, and presets only set them.

export type DatabasePlayer = ContentDatabase["players"][number] & {
	teamName: string;
	league?: string;
};

/** Every player with the name and league of their team. */
export function databasePlayers(
	database: ContentDatabase,
): readonly DatabasePlayer[] {
	const teams = new Map(database.teams.map((team) => [team.id, team]));
	return database.players.map((player) => {
		const team = teams.get(player.team);
		return {
			...player,
			teamName: team?.name ?? player.team,
			...(team?.league && { league: team.league }),
		};
	});
}

export type DatabaseFilters = {
	/** Empty means every role. */
	roles: readonly Role[];
	rating: Range;
	league: string | null;
	team: string | null;
	nationality: string | null;
	status: "starter" | "sub" | null;
};

export type DatabaseFilterKey = keyof DatabaseFilters;

export const EMPTY_DATABASE_FILTERS: DatabaseFilters = {
	roles: [],
	rating: {},
	league: null,
	team: null,
	nationality: null,
	status: null,
};

const ORDER = Object.keys(EMPTY_DATABASE_FILTERS) as DatabaseFilterKey[];

const inRange = (value: number, { min, max }: Range) =>
	(min === undefined || value >= min) && (max === undefined || value <= max);

const isActive = (value: DatabaseFilters[DatabaseFilterKey]) =>
	Array.isArray(value)
		? value.length > 0
		: typeof value === "object" && value !== null
			? Object.values(value).some((end) => end !== undefined)
			: value !== null;

/** The filters in use, in the order of the panel. */
export const activeDatabaseFilters = (filters: DatabaseFilters) =>
	ORDER.filter((key) => isActive(filters[key]));

export function filterDatabasePlayers(
	players: readonly DatabasePlayer[],
	filters: DatabaseFilters,
): readonly DatabasePlayer[] {
	if (activeDatabaseFilters(filters).length === 0) return players;
	const roles = new Set(filters.roles);
	const { league, team, nationality, status } = filters;
	return players.filter(
		(player) =>
			(roles.size === 0 || roles.has(player.role)) &&
			inRange(player.level, filters.rating) &&
			(league === null || player.league === league) &&
			(team === null || player.team === team) &&
			(nationality === null || player.nationality === nationality) &&
			(status === null || player.sub === (status === "sub")),
	);
}

export const DATABASE_PRESETS = ["top", "starters"] as const;
export type DatabasePreset = (typeof DATABASE_PRESETS)[number];

const TOP_MIN_RATING = 80;

const RULES: Record<
	DatabasePreset,
	{
		on: (f: DatabaseFilters) => boolean;
		set: (f: DatabaseFilters) => DatabaseFilters;
		unset: (f: DatabaseFilters) => DatabaseFilters;
	}
> = {
	top: {
		on: (f) => f.rating.min === TOP_MIN_RATING,
		set: (f) => ({ ...f, rating: { ...f.rating, min: TOP_MIN_RATING } }),
		unset: (f) => {
			const { min: _, ...rest } = f.rating;
			return { ...f, rating: rest };
		},
	},
	starters: {
		on: (f) => f.status === "starter",
		set: (f) => ({ ...f, status: "starter" }),
		unset: (f) => ({ ...f, status: null }),
	},
};

export const isDatabasePresetOn = (
	filters: DatabaseFilters,
	preset: DatabasePreset,
) => RULES[preset].on(filters);

export const toggleDatabasePreset = (
	filters: DatabaseFilters,
	preset: DatabasePreset,
) =>
	RULES[preset].on(filters)
		? RULES[preset].unset(filters)
		: RULES[preset].set(filters);
