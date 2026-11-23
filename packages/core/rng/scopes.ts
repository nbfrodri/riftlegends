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
} as const;
