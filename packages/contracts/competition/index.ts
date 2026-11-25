import { z } from "zod";
import { defineCommands, defineQueries, position } from "../envelope";
import type { CoreError } from "../errors";
import { defineFacts } from "../facts";
import {
	type Competition,
	competitionCriterion,
	competitionSchema,
} from "./format";

export * from "./format";
export * from "./views";

// Catalog of plan 12: formats, seasons and competition facts.

const id = z.string().min(1).max(64);
const teamId = id;
const uint32 = z
	.int()
	.min(0)
	.max(2 ** 32 - 1);
const pair = <T extends z.ZodType>(item: T) => z.tuple([item, item]);

/**
 * Checks a custom format on its own. The path is relative to the
 * competition, so the UI can point at the field.
 */
export const validateFormat = (
	raw: unknown,
): { ok: true; competition: Competition } | { ok: false; error: CoreError } => {
	const result = competitionSchema.safeParse(raw);
	if (result.success) return { ok: true, competition: result.data };
	const path = result.error.issues[0]?.path.join(".") ?? "";
	return { ok: false, error: { code: "invalid-format", params: { path } } };
};

const team = z.strictObject({
	id: teamId,
	/** League the team plays in. */
	competition: id,
	region: id,
	/** Global seed, 1 is the strongest. */
	rank: z.int().min(1),
});

const seasonBody = {
	year: z.int().min(1970).max(9999),
	/** Root seed of the competition's RNG (plan 05). */
	seed: uint32,
	competitions: z.array(competitionSchema).min(1).max(16),
	teams: z.array(team).max(256),
};

export const competitionCommands = defineCommands({
	"season.create": z.strictObject(seasonBody),
	/** Plays every series scheduled for the given day, counted from the season start. */
	"season.playDay": z.strictObject({ day: z.int().min(0).max(1000) }),
});

const competitionRef = z.strictObject({ competition: id });
export const competitionQueries = defineQueries({
	"competition.standings": z.strictObject({ competition: id, stage: id }),
	"competition.bracket": z.strictObject({ competition: id, stage: id }),
	"competition.schedule": z.strictObject({
		competition: id.optional(),
		team: teamId.optional(),
		fromDay: z.int().min(0).optional(),
		toDay: z.int().min(0).optional(),
	}),
	"competition.qualified": competitionRef,
	/** Every competition with its stages and state, and the day to play next. */
	"season.overview": z.strictObject({}),
	/** The season of one team: roster, series, form, streak and statistics. */
	"team.profile": z.strictObject({ team: teamId }),
	/**
	 * `series.summary` and `match.view` of a series of the season, by the id
	 * that `competition.schedule` gives it. With `series` they are answered
	 * from the season, not from a draft series.
	 */
	"series.summary": z.strictObject({ series: id }),
	"match.view": z.strictObject({ series: id, game: position }),
});

const count = z.int().min(0);

/** Why a team sits where it does: the criterion that split it from the tied ones. */
const explanation = z.strictObject({
	criterion: z.union([competitionCriterion, z.literal("none")]),
	tied: z.array(teamId),
	values: z.record(teamId, z.int()),
});

const factCatalog = defineFacts({
	/** Copies the formats, so later content updates never change this season (P4). */
	"season.created": {
		...seasonBody,
		contentVersion: z.string().min(1).max(64),
	},
	"competition.seriesRecorded": {
		competition: id,
		stage: id,
		day: count,
		round: count,
		/** `score` follows the order of `teams`. */
		teams: pair(teamId),
		score: pair(count),
		winner: teamId,
		tiebreaker: z.boolean(),
	},
	"competition.stageFinished": {
		competition: id,
		stage: id,
		standings: z.array(
			z.strictObject({
				team: teamId,
				rank: z.int().min(1),
				seriesWins: count,
				seriesLosses: count,
				gameWins: count,
				gameLosses: count,
				explanation,
			}),
		),
	},
	"competition.qualified": {
		from: id,
		to: id,
		team: teamId,
		rule: z.enum(["stageWinner", "standing", "points"]),
		via: z.enum(["direct", "cascade"]),
	},
	"competition.paired": {
		competition: id,
		stage: id,
		round: count,
		pairs: z.array(pair(teamId)),
		/** Constraints relaxed to find a pairing, in order. */
		relaxed: z.array(z.enum(["region", "rematch"])),
	},
});

export const competitionFacts = {
	schema: factCatalog.schema
		.refine(
			(fact) =>
				fact.type !== "competition.seriesRecorded" ||
				(fact.teams[0] !== fact.teams[1] && fact.teams.includes(fact.winner)),
			{ error: "the winner must be one of two distinct teams" },
		)
		.refine(
			(fact) =>
				fact.type !== "competition.paired" ||
				fact.pairs.every(([a, b]) => a !== b),
			{ error: "a team cannot face itself" },
		),
};
