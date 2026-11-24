export interface SwissTeam {
	readonly id: string;
	/** Used to keep teams of one region apart in round 1. */
	readonly region?: string;
}

export interface SwissRules {
	/** Wins that qualify. */
	readonly wins: number;
	/** Losses that eliminate. */
	readonly losses: number;
	/** Bo of an ordinary series. */
	readonly bestOf: number;
	/** Bo of a series where a win qualifies or a loss eliminates. */
	readonly decisiveBestOf: number;
	/** Constraints to keep while pairing, relaxed in a fixed order when impossible. */
	readonly avoid: readonly ("region" | "rematch")[];
}

/** A played series, by team id. */
export interface SwissResult {
	readonly winner: string;
	readonly loser: string;
}

export interface SwissRow {
	readonly id: string;
	readonly wins: number;
	readonly losses: number;
	readonly status: "active" | "qualified" | "eliminated";
}

interface SwissPairing {
	/** The better seed of the two. */
	readonly a: string;
	readonly b: string;
	readonly bestOf: number;
	/** Team with game-1 priority, drawn with the `competition` stream. */
	readonly priority: string;
	/** Why they meet: round-1 pots, same record, or different records (last resort). */
	readonly reason: "pots" | "same-record" | "cross-record";
}

export interface SwissRound {
	readonly round: number;
	readonly pairings: readonly SwissPairing[];
	/** Constraints dropped to pair, in the order they were dropped. */
	readonly relaxed: readonly ("region" | "rematch" | "record")[];
}

export interface SwissScope {
	/** Indexes of competition, season and stage (never hashes of text ids). */
	readonly competition: number;
	readonly season: number;
	readonly stage: number;
}

/** Records and status after the rounds played so far. */
export function swissStandings(
	_teams: readonly SwissTeam[],
	_played: readonly (readonly SwissResult[])[],
	_rules: Pick<SwissRules, "wins" | "losses">,
): SwissRow[] {
	return [];
}

/** Pairs the next Swiss round, or returns null when the stage is over. */
export function pairSwissRound(
	_teams: readonly SwissTeam[],
	_played: readonly (readonly SwissResult[])[],
	_rules: SwissRules,
	_rootSeed: number,
	_scope: SwissScope,
): SwissRound | null {
	return null;
}
