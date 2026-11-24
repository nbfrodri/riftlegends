import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	type BestOf,
	type Bracket,
	buildDoubleElim,
	buildSingleElim,
	type DoubleElim,
	seedEntrants,
} from "./bracket";
import { type BracketState, resolveBracket } from "./bracket-state";

const bo = (n: number, v: BestOf = 3): BestOf[] => Array(n).fill(v);
const teamsOf = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

const single = (size: number, bestOf: BestOf[]) =>
	buildSingleElim({ type: "singleElim", size, bestOf });

const double = (
	size: number,
	upper: number,
	drop: number[],
	lower: number,
	extra: Partial<DoubleElim> = {},
) =>
	buildDoubleElim({
		type: "doubleElim",
		size,
		upper: bo(upper),
		lower: bo(lower),
		drop,
		grandFinal: 5,
		reset: false,
		...extra,
	});

/** Standard brackets: [size, upper rounds, drop, lower rounds]. */
const DOUBLE_CASES: [number, number, number[], number][] = [
	[4, 2, [0, 1], 2],
	[6, 3, [0, 0, 2], 3],
	[8, 3, [0, 1, 3], 4],
	[16, 4, [0, 1, 3, 5], 6],
];

/** Plays every ready match; `pick(a, b, id)` returns true when a wins. */
const play = (
	bracket: Bracket,
	teams: string[],
	pick: (a: string, b: string, id: string) => boolean,
): BracketState => {
	const results: Record<string, string> = {};
	for (;;) {
		const state = resolveBracket(bracket, teams, results);
		const next = state.matches.find((m) => m.status === "ready");
		if (!next) return state;
		const [a, b] = [next.teamA as string, next.teamB as string];
		results[next.id] = pick(a, b, next.id) ? a : b;
	}
};

const pairing = (bracket: Bracket, teams: string[], round: number) =>
	resolveBracket(bracket, teams, {})
		.matches.filter((m) => m.side === "upper" && m.round === round)
		.map((m) => [m.teamA, m.teamB]);

describe("B1: single elimination by seed", () => {
	it("pairs 1-8, 4-5, 2-7, 3-6 with 8 teams", () => {
		const teams = teamsOf(8);
		expect(pairing(single(8, bo(3)), teams, 1)).toEqual([
			["t1", "t8"],
			["t4", "t5"],
			["t2", "t7"],
			["t3", "t6"],
		]);
	});

	it("meets 1 against the 4-5 winner and 2 against the 3-6 winner", () => {
		const teams = teamsOf(8);
		const state = play(single(8, bo(3)), teams, (a, b) => a < b);
		const round2 = state.matches.filter((m) => m.round === 2);
		expect(round2.map((m) => [m.teamA, m.teamB])).toEqual([
			["t1", "t4"],
			["t2", "t3"],
		]);
	});
});

describe("B2: byes for the top seeds", () => {
	it("gives seeds 1 and 2 a bye with 6 teams", () => {
		const state = resolveBracket(single(6, bo(3)), teamsOf(6), {});
		const round1 = state.matches.filter((m) => m.round === 1);
		expect(round1.map((m) => [m.teamA, m.teamB])).toEqual([
			["t4", "t5"],
			["t3", "t6"],
		]);
		const round2 = state.matches.filter((m) => m.round === 2);
		expect(round2.map((m) => [m.teamA, m.teamB])).toEqual([
			["t1", null],
			["t2", null],
		]);
	});

	it("gives seeds 1 to 6 a bye with 10 teams", () => {
		const state = resolveBracket(single(10, bo(4)), teamsOf(10), {});
		const round1 = state.matches.filter((m) => m.round === 1);
		expect(round1.map((m) => [m.teamA, m.teamB])).toEqual([
			["t8", "t9"],
			["t7", "t10"],
		]);
	});
});

describe("B3: double elimination drops", () => {
	it("sends the upper round 1 losers of 4 to lower round 1 and the final loser to lower round 2", () => {
		const bracket = double(4, 2, [0, 1], 2);
		const lower = bracket.matches.filter((m) => m.side === "lower");
		expect(lower).toHaveLength(2);
		expect(lower[0]).toMatchObject({
			a: { kind: "loser", match: "U1-1" },
			b: { kind: "loser", match: "U1-2" },
		});
		expect(lower[1]).toMatchObject({
			a: { kind: "winner", match: "L1-1" },
			b: { kind: "loser", match: "U2-1" },
		});
	});

	it("crosses survivors with the dropped teams with 8", () => {
		const bracket = double(8, 3, [0, 1, 3], 4);
		const ids = (round: number) =>
			bracket.matches.filter((m) => m.side === "lower" && m.round === round);
		expect(ids(1)).toHaveLength(2);
		expect(ids(2).map((m) => [m.a, m.b])).toEqual([
			[
				{ kind: "winner", match: "L1-1" },
				{ kind: "loser", match: "U2-2" },
			],
			[
				{ kind: "winner", match: "L1-2" },
				{ kind: "loser", match: "U2-1" },
			],
		]);
		expect(ids(3)).toHaveLength(1);
		expect(ids(4)[0]?.b).toEqual({ kind: "loser", match: "U3-1" });
	});

	it("enters the losers of rounds 1 and 2 together with 6 and avoids rematches", () => {
		const bracket = double(6, 3, [0, 0, 2], 3);
		const lower1 = bracket.matches.filter(
			(m) => m.side === "lower" && m.round === 1,
		);
		expect(lower1.map((m) => [m.a, m.b])).toEqual([
			[
				{ kind: "loser", match: "U1-1" },
				{ kind: "loser", match: "U2-2" },
			],
			[
				{ kind: "loser", match: "U1-2" },
				{ kind: "loser", match: "U2-1" },
			],
		]);
	});

	it("lets the first team of an odd pool through", () => {
		// 6 teams: round 2 losers enter alone beside one survivor (3 teams).
		const bracket = double(6, 3, [0, 1, 3], 4);
		const lower2 = bracket.matches.filter(
			(m) => m.side === "lower" && m.round === 2,
		);
		expect(lower2).toHaveLength(1);
		expect(lower2[0]).toMatchObject({
			a: { kind: "loser", match: "U2-1" },
			b: { kind: "loser", match: "U2-2" },
		});
	});

	it("rejects drops the format cannot place", () => {
		expect(() => double(4, 2, [0, 5], 2)).toThrow(RangeError);
		expect(() => double(4, 2, [0], 2)).toThrow(RangeError);
		expect(() => double(8, 3, [0, 1, 3], 3)).toThrow(RangeError);
		expect(() => double(8, 3, [0, 0, 0], 4)).toThrow(RangeError);
	});
});

describe("B4: grand final reset", () => {
	const teams = teamsOf(4);
	const bracket = (reset: boolean) => double(4, 2, [0, 1], 2, { reset });
	// The better seed wins in the upper bracket; t3 loses there, then wins
	// every lower series and the finals.
	const lowerWins = (a: string, b: string, id: string) =>
		id.startsWith("U") ? a < b : a === "t3";

	it("ends at the final by default, even when the lower bracket wins", () => {
		const state = play(bracket(false), teams, lowerWins);
		expect(state.champion).toBe("t3");
		expect(state.matches.map((m) => m.id)).not.toContain("RS");
	});

	it("plays one more final with reset when the lower bracket team wins", () => {
		const state = play(bracket(true), teams, lowerWins);
		const reset = state.matches.find((m) => m.id === "RS");
		expect(reset?.status).toBe("done");
		expect(state.champion).toBe(reset?.winner);
	});

	it("skips the reset when the upper bracket team wins the final", () => {
		const state = play(bracket(true), teams, (a, b) => a < b);
		expect(state.matches.find((m) => m.id === "RS")?.status).toBe("skipped");
		expect(state.champion).toBe("t1");
	});

	it("does not offer the reset before the final is played", () => {
		const state = resolveBracket(bracket(true), teams, {});
		expect(state.matches.find((m) => m.id === "RS")?.status).toBe("waiting");
	});
});

describe("B6: fixed bracket and game 1 priority", () => {
	it("gives the better seed the priority with its seeds as the reason", () => {
		const state = resolveBracket(single(8, bo(3)), teamsOf(8), {});
		const m = state.matches.find((x) => x.id === "U1-2");
		expect(m?.priority).toEqual({ team: "t4", seed: 4, otherSeed: 5 });
	});

	it("keeps the priority of the better seed in later rounds", () => {
		const teams = teamsOf(8);
		const state = play(single(8, bo(3)), teams, (a, b) => a > b);
		const final = state.matches.at(-1);
		expect(final?.priority?.seed).toBeLessThan(final?.priority?.otherSeed ?? 0);
	});

	it("orders teams with the same seed by their source standings", () => {
		const order = seedEntrants([
			{ team: "b1", seed: 2, origin: 4 },
			{ team: "a1", seed: 1, origin: 1 },
			{ team: "b2", seed: 2, origin: 2 },
			{ team: "c1", seed: 3, origin: 1 },
		]);
		expect(order).toEqual(["a1", "b2", "b1", "c1"]);
	});

	it("rejects results for matches that are not ready or teams not in them", () => {
		const bracket = single(4, bo(2));
		const teams = teamsOf(4);
		expect(() => resolveBracket(bracket, teams, { "U2-1": "t1" })).toThrow(
			RangeError,
		);
		expect(() => resolveBracket(bracket, teams, { "U1-1": "t2" })).toThrow(
			RangeError,
		);
	});
});
