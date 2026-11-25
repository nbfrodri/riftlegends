import type { Competition } from "@rift-legends/contracts/competition-format";

type Stage = Competition["stages"][number];
type Source = Exclude<Stage["entrants"], unknown[]>;
type Play = Stage["play"];
type Bo = 1 | 3 | 5;

export interface FixtureEvidence {
	page: string;
	tabs: RegExp;
	/** A historical team identifies an isolated group or play-in lane. */
	anchor?: string;
	match?: number;
}

export interface LeagueStage {
	id: string;
	evidence: FixtureEvidence;
	entrants: Stage["entrants"] | "roster";
	play: Play;
	parallelGroup?: Stage["parallelGroup"];
}

export interface LeagueDefinition {
	stages: LeagueStage[];
	/** Finish stages, with place counts in First Stand, MSI and Worlds order. */
	qualifiers: [string, number][];
	notes: string[];
	/** Tiebreak rules read from the league's own rulebook; absent means game defaults. */
	tiebreakRule?: {
		criteria: Competition["tiebreak"];
		bestOf: Bo;
		reason: string;
	};
}

export const weeks = /^Week \d+$/;
export const rounds = /^Round \d+$|^Finals$/;

export const standing = (stage: string, from: number, to = from): Source => ({
	kind: "standing",
	stage,
	from,
	to,
});

export const result = (
	stage: string,
	match = "U1-1",
	result: "winner" | "loser" = "winner",
): Source => ({
	kind: "bracket",
	stage,
	match,
	result,
});

export const stage = (
	id: string,
	page: string,
	tabs: RegExp,
	entrants: LeagueStage["entrants"],
	play: Play,
	{
		parallelGroup,
		...selection
	}: Pick<LeagueStage, "parallelGroup"> &
		Pick<FixtureEvidence, "anchor" | "match"> = {},
): LeagueStage => ({
	id,
	evidence: { page, tabs, ...selection },
	entrants,
	play,
	parallelGroup,
});

export const rr = (size: number, rounds: 1 | 2 = 1, bestOf: Bo = 3): Play => ({
	type: "roundRobin",
	size,
	rounds,
	bestOf,
});

export const single = (bestOf: Bo): Play => ({
	type: "singleElim",
	size: 2,
	bestOf: [bestOf],
});

export const double = (
	size: number,
	drop: (number | null)[][],
	lower: Bo[],
	lowerSeeds: number[] = [],
	upper: Bo[] = drop.map(() => 5),
	grandFinal: Bo | null = 5,
): Play => ({
	type: "doubleElim",
	size,
	upper,
	lower,
	drop,
	lowerSeeds,
	grandFinal,
	reset: false,
});

export const asymmetricSix = (early: Bo = 5) =>
	double(6, [[0, 0], [1, 2], [3]], [5, 5, 5, 5], [], [early, early, 5]);

export const lowerEntrySix = () => double(6, [[0, 0], [2]], [5, 5, 5], [2]);
export const eight = (early: Bo = 5) =>
	double(
		8,
		[[0, 0, 0, 0], [1, 1], [3]],
		[early, early, 5, 5],
		[],
		[early, early, 5],
	);

export const swiss = (decisiveBestOf: Bo, maxRounds?: number): Play => ({
	type: "swiss",
	size: 8,
	wins: 3,
	losses: 3,
	bestOf: 3,
	decisiveBestOf,
	round1: "pots",
	avoid: ["rematch"],
	maxRounds,
});

export function twoSeries(
	block: string,
	page: string,
	tabs: RegExp,
	pairs: [Source[], Source[]],
	bo: Bo,
): LeagueStage[] {
	return pairs.map((entrants, i) =>
		stage(`${block}-${i + 1}`, page, tabs, entrants, single(bo), {
			match: i + 1,
			parallelGroup: block,
		}),
	);
}
