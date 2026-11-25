import { z } from "zod";
import { ROLES } from "./index.ts";

/** Basis points: 10 000 is 100 %. */
const bp = z.number().int().min(0).max(10_000);
const count = z.number().int().min(0);

const taken = z.strictObject({
	taken: count,
	more: count,
	fewer: count,
	moreBp: bp,
	fewerBp: bp,
});

const margin = z.strictObject({
	margin: z.enum(["1", "2", "3+"]),
	fights: count,
	converted: count,
	bp,
});

const minuteLevels = z.array(z.number().int().min(10).max(200));

/**
 * Aggregates of Riot match timelines hosted by Leaguepedia. Only figures that
 * summarise many games: no game, team or player is stored. LPL has no
 * timelines, so it is not a key.
 */
export const realTimelinesSchema = z
	.strictObject({
		provenance: z.strictObject({
			source: z.literal("Leaguepedia"),
			domain: z.literal("lol.fandom.com"),
			licence: z.string().min(1),
			attribution: z.string().min(1),
			season: z.number().int(),
		}),
		/** Games used per league. */
		games: z.strictObject({
			CBLOL: count.optional(),
			LCK: count.optional(),
			LCP: count.optional(),
			LCS: count.optional(),
			LEC: count.optional(),
		}),
		bands: z.strictObject({
			/** K19: objectives taken with more or fewer players alive. */
			k19: z.strictObject({
				baron: taken,
				inhibitor: taken,
				tower: taken,
			}),
			/** K20: the fight winner takes an objective within 60 s, by kill margin. */
			k20: z.tuple([margin, margin, margin]),
			/** K21: late fights that end the game and deaths when the nexus falls. */
			k21: z.strictObject({
				lateFights: z.strictObject({ fights: count, closed: count, bp }),
				nexus: z.strictObject({ games: count, threeOrMore: count, bp }),
			}),
			/** K22: death time in seconds. */
			k22: z.strictObject({
				deaths: count,
				p10: count,
				p50: count,
				p90: count,
			}),
		}),
		/** Median level per role and minute (1, 2, ...), in tenths of a level. */
		levelCurve: z.strictObject(
			Object.fromEntries(ROLES.map((role) => [role, minuteLevels])) as Record<
				(typeof ROLES)[number],
				typeof minuteLevels
			>,
		),
	})
	.refine((file) => {
		const lengths = Object.values(file.levelCurve).map((list) => list.length);
		return lengths.every((length) => length === lengths[0]);
	});

export type RealTimelines = z.infer<typeof realTimelinesSchema>;
