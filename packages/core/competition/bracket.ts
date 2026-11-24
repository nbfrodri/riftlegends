import type { Competition } from "@rift-legends/contracts";

// Single and double elimination brackets (plan 12, B1-B6). The bracket is
// pure structure: matches refer to seeds, winners and losers of other
// matches. `resolveBracket` fills in the teams from the results played so far.

type Play = Competition["stages"][number]["play"];
export type SingleElim = Extract<Play, { type: "singleElim" }>;
export type DoubleElim = Extract<Play, { type: "doubleElim" }>;
export type BestOf = SingleElim["bestOf"][number];

/** Where a team of a match comes from. `rank` is 1-based (1 = best seed). */
export type Slot =
	| { kind: "seed"; rank: number }
	| { kind: "winner"; match: string }
	| { kind: "loser"; match: string };

interface BracketMatch {
	id: string;
	side: "upper" | "lower" | "final" | "reset";
	/** 1-based round inside its side. */
	round: number;
	bestOf: BestOf;
	a: Slot;
	b: Slot;
}

/** Matches in play order: every match comes after the ones that feed it. */
export interface Bracket {
	size: number;
	matches: BracketMatch[];
	reset: boolean;
}

export interface Entrant {
	team: string;
	/** Seed given by the source stage (lower is better). */
	seed: number;
	/** Place in the source standings: orders teams that share a seed. */
	origin: number;
}

/** Teams from best to worst seed; equal seeds go by their source standings. */
export const seedEntrants = (entrants: readonly Entrant[]): string[] =>
	[...entrants]
		.sort(
			(x, y) =>
				x.seed - y.seed ||
				x.origin - y.origin ||
				(x.team < y.team ? -1 : x.team > y.team ? 1 : 0),
		)
		.map((e) => e.team);

/** Seed order of a bracket of `n` (a power of two): 1-8, 4-5, 2-7, 3-6. */
const seedOrder = (n: number): number[] => {
	let order = [1];
	while (order.length < n) {
		const total = order.length * 2;
		order = order.flatMap((s) => [s, total + 1 - s]);
	}
	return order;
};

const roundCount = (size: number): number => {
	let rounds = 0;
	for (let p = 1; p < size; p *= 2) rounds += 1;
	return rounds;
};

interface Upper {
	matches: BracketMatch[];
	/** Ids of the matches played in each upper round (byes play none). */
	byRound: string[][];
	champion: Slot;
}

/**
 * Upper bracket: with a size that is not a power of two the best seeds meet
 * a missing opponent in round 1 and go straight to round 2 (bye).
 */
const buildUpper = (size: number, bestOf: readonly BestOf[]): Upper => {
	if (!Number.isInteger(size) || size < 2) {
		throw new RangeError(`A bracket needs at least 2 teams, got ${size}`);
	}
	const rounds = roundCount(size);
	if (bestOf.length !== rounds) {
		throw new RangeError(`Expected ${rounds} Bo values, got ${bestOf.length}`);
	}
	// Missing seeds stay as holes, so their opponents get a bye.
	const full = seedOrder(2 ** rounds).map((rank) =>
		rank <= size ? ({ kind: "seed", rank } as Slot) : null,
	);
	const matches: BracketMatch[] = [];
	const byRound: string[][] = [];
	let line = full;
	for (let r = 0; r < rounds; r += 1) {
		const next: (Slot | null)[] = [];
		const played: string[] = [];
		for (let i = 0; i < line.length; i += 2) {
			const a = line[i] ?? null;
			const b = line[i + 1] ?? null;
			if (a === null || b === null) {
				next.push(a ?? b);
				continue;
			}
			const id = `U${r + 1}-${played.length + 1}`;
			played.push(id);
			matches.push({
				id,
				side: "upper",
				round: r + 1,
				bestOf: bestOf[r] as BestOf,
				a,
				b,
			});
			next.push({ kind: "winner", match: id });
		}
		byRound.push(played);
		line = next;
	}
	return { matches, byRound, champion: line[0] as Slot };
};

export const buildSingleElim = (format: SingleElim): Bracket => ({
	size: format.size,
	matches: buildUpper(format.size, format.bestOf).matches,
	reset: false,
});

export const buildDoubleElim = (format: DoubleElim): Bracket => ({
	size: format.size,
	matches: [],
	reset: format.reset,
});
