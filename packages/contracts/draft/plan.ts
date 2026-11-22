import { z } from "zod";
import { position } from "../envelope";

export const teamStrategy = z.strictObject({
	tempo: z.enum(["slow", "balanced", "fast"]),
	objectives: z.enum(["dragon", "balanced", "baron"]),
	risk: z.enum(["safe", "balanced", "risky"]),
});

export type TeamStrategy = z.infer<typeof teamStrategy>;

/** What `match.plan` answers for the only human team after both role assignments. */
export const matchPlan = z.strictObject({
	game: position,
	team: z.string().min(1).max(64),
	strategy: teamStrategy,
	/** Fixed-point contributions to the lever named by each key's prefix; only those matching the lever's chosen direction, strongest first. */
	causes: z.array(
		z.strictObject({ key: z.string().min(1).max(64), points: z.int() }),
	),
});

export type MatchPlan = z.infer<typeof matchPlan>;
