/**
 * Registry of RNG scopes. Each number feeds `deriveSeed`, so it must never be
 * reused or renumbered: doing so would change every saved game and golden.
 */
export const SCOPES = {
	draft: 1,
	match: 2,
	ai: 3,
	/** The AI's side choice (issue #305). */
	side: 4,
	/** Who scores and who assists each kill of a match (issue #346). */
	matchAttribution: 5,
	/** Competition draws: game-1 priority, Swiss, groups and the final tiebreak (plan 12). */
	competition: 6,
	/** Seconds between casualties inside a fight (issue #366). */
	matchFightTiming: 7,
	/** Pit attendance and opposing Smite for objective steals (issue #508). */
	matchSteal: 8,
	/** Scheduling draws within a season (plan 12). */
	schedule: 9,
	/** First-round draws of elimination brackets (plan 12 §6, #626). */
	stageDraw: 10,
} as const;
