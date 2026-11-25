import { z } from "zod";
import { seriesOptions } from "./index";
import { matchContent } from "./match";

// The database section (#443): every player and team of a content set, with
// what the content brings and nothing more.

const option = seriesOptions.shape.teams.element;

/** What `content.database` answers. Teams and players follow the content order. */
export const contentDatabase = z.strictObject({
	teams: z.array(
		option
			.pick({ id: true, name: true, seed: true, coach: true, league: true })
			.extend({ short: matchContent.shape.teams.element.shape.short }),
	),
	players: z.array(
		option.shape.players.element.extend({
			team: option.shape.id,
			level: z.int().min(0).max(100),
			/** A bench player rather than the starter of the role. */
			sub: z.boolean(),
		}),
	),
});

export type ContentDatabase = z.infer<typeof contentDatabase>;
