/**
 * Registry of RNG scopes. Each number feeds `deriveSeed`, so it must never be
 * reused or renumbered: doing so would change every saved game and golden.
 */
export const SCOPES = {
	draft: 1,
	match: 2,
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];
