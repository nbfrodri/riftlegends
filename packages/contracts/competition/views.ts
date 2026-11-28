import { z } from "zod";
import { ROLES } from "../draft/index";
import { competitionCriterion, drawRule, stageNameSchema } from "./format";

// What the view queries of plan 31 answer (#481).

const id = z.string().min(1).max(64);
const count = z.int().min(0);
const status = z.enum(["pending", "live", "finished"]);

const seasonOverview = z.strictObject({
	year: z.int(),
	/** The next day with a series to play, or `null` when the season is over. */
	day: count.nullable(),
	competitions: z.array(
		z.strictObject({
			id,
			status,
			/** Top of the table of the stage being played; only while it is live. */
			leader: z
				.strictObject({ team: id, seriesWins: count, seriesLosses: count })
				.optional(),
			/** Winner of the last stage, once the competition is finished. */
			champion: id.optional(),
			stages: z.array(
				z.strictObject({
					stage: id,
					/** How the stage is played: a bracket has `competition.bracket`. */
					play: z.enum([
						"roundRobin",
						"groups",
						"swiss",
						"singleElim",
						"doubleElim",
					]),
					name: stageNameSchema.optional(),
					status,
					startDay: count,
					endDay: count,
				}),
			),
		}),
	),
});

/** One series of a team, seen from the team. */
const teamSeries = z.strictObject({
	/** The id of `competition.schedule`, to open the series. */
	series: id,
	competition: id,
	stage: id,
	day: count,
	opponent: id,
	/** Games won by the team, then by the opponent. */
	score: z.tuple([count, count]),
	won: z.boolean(),
});

const teamProfile = z.strictObject({
	team: z.strictObject({
		id,
		name: z.string(),
		short: id.optional(),
		league: id.optional(),
		seed: z.int().positive(),
	}),
	players: z.array(
		z.strictObject({
			id,
			handle: z.string(),
			role: z.enum(ROLES),
			level: z.int(),
			nationality: z.string().optional(),
			sub: z.boolean(),
		}),
	),
	/** The five latest series, newest first. */
	recent: z.array(teamSeries).max(5),
	/** Every series of the season, newest first. */
	series: z.array(teamSeries),
	/** What the team has won or lost in a row, counting back from the latest series. */
	streak: z
		.strictObject({ result: z.enum(["won", "lost"]), length: z.int().min(1) })
		.nullable(),
	stats: z.strictObject({
		seriesWon: count,
		seriesLost: count,
		gamesWon: count,
		gamesLost: count,
		/** Seconds, rounded down; `null` before the first game. */
		averageDuration: count.nullable(),
		players: z.array(
			z.strictObject({
				player: id,
				games: count,
				kills: count,
				deaths: count,
				assists: count,
			}),
		),
		/** The five most played, most first. */
		champions: z.array(z.strictObject({ champion: id, games: count })).max(5),
	}),
});

/** Where a team of a bracket series comes from (`rank` is 1-based). */
const bracketSlot = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("seed"), rank: z.int().min(1) }),
	z.strictObject({ kind: z.enum(["winner", "loser"]), match: id }),
]);

const bracket = z.strictObject({
	/** In play order: every series comes after the ones that feed it. */
	matches: z.array(
		z.strictObject({
			id,
			side: z.enum(["upper", "lower", "final", "reset"]),
			/** 1-based round inside its side. */
			round: z.int().min(1),
			bestOf: z.int().min(1).max(5),
			teamA: id.nullable(),
			teamB: id.nullable(),
			priority: z
				.strictObject({ team: id, seed: z.int(), otherSeed: z.int() })
				.nullable(),
			/** `skipped`: a reset final that the upper team made unnecessary. */
			status: z.enum(["waiting", "ready", "done", "skipped"]),
			winner: id.nullable(),
			loser: id.nullable(),
			from: z.tuple([bracketSlot, bracketSlot]),
			/** Once played: the id of `competition.schedule` that opens it. */
			series: id.optional(),
			/** Once played: games won by `teamA`, then by `teamB`. */
			score: z.tuple([count, count]).optional(),
		}),
	),
	champion: id.nullable(),
	/** Series lost by each team so far. */
	losses: z.record(id, count),
	/** The draw that ordered the first round, for stages that have one (#628). */
	draw: z
		.strictObject({
			/** Teams from the best seed down, with their 1-based tier. */
			tiers: z.array(z.strictObject({ team: id, tier: z.int().min(1) })),
			/** First-round series in bracket order, better seed first. */
			pairs: z.array(z.tuple([id, id])),
			/** Constraints the draw had to break, in their order. */
			relaxed: z.array(drawRule),
		})
		.optional(),
});

export type BracketView = z.infer<typeof bracket>;

const standingRow = z.strictObject({
	team: id,
	rank: z.int().min(1),
	seriesWins: count,
	seriesLosses: count,
	gameWins: count,
	gameLosses: count,
	/**
	 * The criterion that split the team from the ones it was tied with (`tied`,
	 * itself included) and each one's value. `none` with teams in `tied`: a
	 * tiebreaker series is still to play.
	 */
	explanation: z.strictObject({
		criterion: z.union([competitionCriterion, z.literal("none")]),
		tied: z.array(id),
		values: z.record(id, z.int()),
	}),
});

const table = {
	rows: z.array(standingRow),
	/** Tiebreaker series still to play. */
	pending: z.array(z.strictObject({ a: id, b: id })),
};

const standings = z.strictObject({
	...table,
	/** The two group tables of a cross-group stage (LCK Cup), by group result. */
	groups: z
		.strictObject({
			winner: z.strictObject({ ...table, points: count }),
			loser: z.strictObject({ ...table, points: count }),
		})
		.optional(),
	/**
	 * A Swiss stage, round by round (#487): each series with the balance its
	 * teams brought to it, the constraints relaxed to pair the round and where
	 * each team stands.
	 */
	swiss: z
		.strictObject({
			wins: count,
			losses: count,
			/** Rounds the stage plays at most, paired or not. */
			totalRounds: z.int().min(1),
			rounds: z.array(
				z.strictObject({
					round: z.int().min(1),
					relaxed: z.array(z.enum(["region", "rematch"])),
					series: z.array(
						z.strictObject({
							teams: z.tuple([id, id]),
							/** Wins and losses of the first team before the series. */
							record: z.tuple([count, count]),
							winner: id.optional(),
							/** Games won by each team, in the order of `teams`. */
							score: z.tuple([count, count]).optional(),
							/** The id of `competition.schedule` that opens it. */
							series: id.optional(),
						}),
					),
				}),
			),
			teams: z.array(
				z.strictObject({
					team: id,
					wins: count,
					losses: count,
					status: z.enum(["active", "qualified", "eliminated"]),
				}),
			),
		})
		.optional(),
	/**
	 * Where the places of the table lead, from the formats: a later stage
	 * (`stage`) or an international event (`competition` alone). `group`
	 * reads the places of one group table.
	 */
	destinations: z.array(
		z.strictObject({
			from: z.int().min(1),
			to: z.int().min(1),
			competition: id,
			stage: id.optional(),
			group: z.enum(["winner", "loser"]).optional(),
		}),
	),
});

export type StandingsView = z.infer<typeof standings>;

/**
 * One series of `competition.schedule`. Open: the core may add detail (its
 * allocation explanation, priority) that the views do not read.
 */
const scheduleSlot = z.object({
	/** Opens the series once played (`series.summary`, `match.view`). */
	id,
	competition: id,
	stage: id,
	day: count,
	/** `null` while the team is not known yet. */
	teams: z.tuple([id.nullable(), id.nullable()]),
	bestOf: z.int().min(1).max(5).optional(),
	status: z.enum(["played", "ready", "pending"]),
	winner: id.optional(),
	/** Games won by each team, in the order of `teams`. */
	score: z.tuple([count, count]).optional(),
	/** In a bracket stage, the id of its series in `competition.bracket`. */
	match: id.optional(),
});

export type ScheduleView = z.infer<typeof scheduleSlot>[];

export const competitionViews = {
	overview: seasonOverview,
	teamProfile,
	bracket,
	standings,
	schedule: z.array(scheduleSlot),
};
