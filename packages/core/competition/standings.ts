export type Criterion =
	| "seriesWins"
	| "gameDiff"
	| "headToHead"
	| "gameWins"
	| "tiebreakerSeries"
	| "draw";

export interface SeriesResult {
	readonly a: string;
	readonly b: string;
	readonly winsA: number;
	readonly winsB: number;
}

export interface Explanation {
	readonly criterion: Criterion | "none";
	readonly tied: readonly string[];
	readonly values: Readonly<Record<string, number>>;
}

export interface StandingRow {
	readonly team: string;
	readonly rank: number;
	readonly seriesWins: number;
	readonly seriesLosses: number;
	readonly gameWins: number;
	readonly gameLosses: number;
	readonly explanation: Explanation;
}

export interface StandingsInput {
	readonly teams: readonly string[];
	readonly results: readonly SeriesResult[];
	readonly tiebreakerResults?: readonly SeriesResult[];
	readonly criteria: readonly Criterion[];
	readonly cuts: readonly number[];
	readonly rootSeed: number;
	readonly scope: { competition: number; season: number; stage: number };
}

export function computeStandings(input: StandingsInput): {
	rows: StandingRow[];
	pending: { a: string; b: string }[];
} {
	return {
		pending: [],
		rows: input.teams.map((team, index) => ({
			team,
			rank: index + 1,
			seriesWins: 0,
			seriesLosses: 0,
			gameWins: 0,
			gameLosses: 0,
			explanation: { criterion: "none", tied: [], values: {} },
		})),
	};
}
