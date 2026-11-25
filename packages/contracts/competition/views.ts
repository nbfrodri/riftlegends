import { z } from "zod";
import { ROLES } from "../draft/index";

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

export const competitionViews = { overview: seasonOverview, teamProfile };
export type SeasonOverview = z.infer<typeof seasonOverview>;
export type TeamProfile = z.infer<typeof teamProfile>;
