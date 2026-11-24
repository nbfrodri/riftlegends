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

