// Stub: the red phase of #423.
import type { Competition } from "@rift-legends/contracts";

type Play = Competition["stages"][number]["play"];
export type SingleElim = Extract<Play, { type: "singleElim" }>;
export type DoubleElim = Extract<Play, { type: "doubleElim" }>;
export type BestOf = SingleElim["bestOf"][number];

export type Slot =
	| { kind: "seed"; rank: number }
	| { kind: "winner"; match: string }
	| { kind: "loser"; match: string };

interface BracketMatch {
	id: string;
	side: "upper" | "lower" | "final" | "reset";
	round: number;
	bestOf: BestOf;
	a: Slot;
	b: Slot;
}

export interface Bracket {
	size: number;
	matches: BracketMatch[];
	reset: boolean;
}

export interface Entrant {
	team: string;
	seed: number;
	origin: number;
}

export const seedEntrants = (_entrants: readonly Entrant[]): string[] => [];

export const buildSingleElim = (format: SingleElim): Bracket => ({
	size: format.size,
	matches: [],
	reset: false,
});

export const buildDoubleElim = (format: DoubleElim): Bracket => ({
	size: format.size,
	matches: [],
	reset: format.reset,
});
