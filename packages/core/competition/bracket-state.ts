import type { Bracket } from "./bracket";

// Stub: the red phase of #423.
interface ResolvedMatch {
	id: string;
	side: "upper" | "lower" | "final" | "reset";
	round: number;
	bestOf: 1 | 3 | 5;
	teamA: string | null;
	teamB: string | null;
	priority: { team: string; seed: number; otherSeed: number } | null;
	status: "waiting" | "ready" | "done" | "skipped";
	winner: string | null;
	loser: string | null;
}

export interface BracketState {
	matches: ResolvedMatch[];
	champion: string | null;
	losses: Record<string, number>;
}

export const resolveBracket = (
	_bracket: Bracket,
	_teams: readonly string[],
	_results: Readonly<Record<string, string>>,
): BracketState => ({ matches: [], champion: null, losses: {} });
