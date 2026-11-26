import { z } from "zod";

// Tournament mode (plan 31): a season of one competition with fixed teams,
// from a preset or from the simple editor of up to two stages.

const id = z.string().min(1).max(64);
const bestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);

/** Real internationals the user can start from, with their slots by region. */
export const TOURNAMENT_PRESETS = ["first-stand", "msi", "worlds"] as const;
export const tournamentPreset = z.enum(TOURNAMENT_PRESETS);

/** Blocks of the simple editor; the second stage is always a knockout. */
export const TOURNAMENT_STAGE_TYPES = [
	"roundRobin",
	"groups",
	"swiss",
	"singleElim",
	"doubleElim",
] as const;

const customStage = z.strictObject({
	type: z.enum(TOURNAMENT_STAGE_TYPES),
	/** One Bo for every series of the stage. */
	bestOf,
	/** Teams of a later stage: the best of the previous one. The first takes them all. */
	size: z.int().min(2).max(32).optional(),
	/** Number of groups, for `groups`. */
	groups: z.int().min(2).max(8).optional(),
});

export const tournamentCreate = z.strictObject({
	year: z.int().min(1970).max(9999),
	seed: z
		.int()
		.min(0)
		.max(2 ** 32 - 1),
	format: z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("preset"), preset: tournamentPreset }),
		z.strictObject({
			kind: z.literal("custom"),
			stages: z.array(customStage).min(1).max(2),
		}),
	]),
	/**
	 * Teams in seed order. A preset takes one per slot, in the order of
	 * `tournament.preset`, and fills them by itself when they are left out.
	 */
	teams: z.array(id).min(2).max(32).optional(),
	/** The team the user manages; without it the user only watches. */
	humanTeam: id.optional(),
	fearless: z.enum(["hard", "soft", "off"]).default("hard"),
});

export type TournamentCreate = z.infer<typeof tournamentCreate>;
export type CustomStage = z.infer<typeof customStage>;

/** What `tournament.preset` answers: each slot with the team that fills it. */
export interface TournamentPresetView {
	readonly preset: z.infer<typeof tournamentPreset>;
	readonly slots: readonly {
		readonly stage: string;
		readonly league: string;
		/** 1-based place in the league. */
		readonly place: number;
		readonly team: string;
	}[];
}
