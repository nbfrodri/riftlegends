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

const fmt = (
	size: number,
	upper: number,
	drop: (number | null)[][],
	lower: number,
	extra: Partial<DoubleElim> = {},
): DoubleElim => ({
	type: "doubleElim",
	size,
	upper: bo(upper),
	lower: bo(lower),
	drop,
	lowerSeeds: [],
	grandFinal: 5,
	reset: false,
	...extra,
});

const double = (
	size: number,
	upper: number,
	drop: (number | null)[][],
	lower: number,
	extra: Partial<DoubleElim> = {},
) => buildDoubleElim(fmt(size, upper, drop, lower, extra));

/** Standard brackets: [size, upper rounds, drop, lower rounds]. */
const DOUBLE_CASES: [number, number, (number | null)[][], number][] = [
	[4, 2, [[0, 0], [1]], 2],
	[6, 3, [[0, 0], [0, 0], [2]], 3],
	[8, 3, [[0, 0, 0, 0], [1, 1], [3]], 4],
	[16, 4, [Array(8).fill(0), Array(4).fill(1), [3, 3], [5]], 6],
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
		const bracket = double(4, 2, [[0, 0], [1]], 2);
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
		const bracket = double(8, 3, [[0, 0, 0, 0], [1, 1], [3]], 4);
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
		const bracket = double(6, 3, [[0, 0], [0, 0], [2]], 3);
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
		const bracket = double(6, 3, [[0, 0], [1, 1], [3]], 4);
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
		expect(() => double(4, 2, [[0, 0], [5]], 2)).toThrow(RangeError);
		expect(() => double(4, 2, [[0, 0]], 2)).toThrow(RangeError);
		expect(() => double(4, 2, [[0], [1]], 2)).toThrow(RangeError);
		expect(() => double(8, 3, [[0, 0, 0, 0], [1, 1], [3]], 3)).toThrow(
			RangeError,
		);
		expect(() => double(8, 3, [[0, 0, 0, 0], [0, 0], [0]], 4)).toThrow(
			RangeError,
		);
	});
});

describe("B4: grand final reset", () => {
	const teams = teamsOf(4);
	const bracket = (reset: boolean) => double(4, 2, [[0, 0], [1]], 2, { reset });
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

describe("B4b: no grand final (GSL groups)", () => {
	const teams = teamsOf(4);
	const gsl = double(4, 2, [[0, 0], [1]], 2, { grandFinal: null });

	it("ends with the lower final and has no GF match", () => {
		const state = play(gsl, teams, (a, b) => a < b);
		expect(state.matches.map((m) => m.id)).not.toContain("GF");
		expect(state.matches.every((m) => m.status === "done")).toBe(true);
	});

	it("ranks the upper final winner first and keeps the lower final winner second", () => {
		const state = play(gsl, teams, (a, b, id) =>
			id.startsWith("U") ? a < b : b < a,
		);
		expect(state.champion).toBe("t1");
		const last = state.matches[state.matches.length - 1];
		expect(last?.side).toBe("lower");
		expect(last?.winner).toBe("t4");
	});

	it("has no champion before the lower final is played", () => {
		const state = resolveBracket(gsl, teams, {});
		expect(state.champion).toBeNull();
	});
});

describe("B5: Bo per round from the format", () => {
	it("uses Bo3 early and Bo5 later (LEC Versus)", () => {
		const format: DoubleElim = {
			type: "doubleElim",
			size: 8,
			upper: [3, 3, 5],
			lower: [3, 3, 5, 5],
			drop: [[0, 0, 0, 0], [1, 1], [3]],
			lowerSeeds: [],
			grandFinal: 5,
			reset: false,
		};
		const state = resolveBracket(buildDoubleElim(format), teamsOf(8), {});
		const bestOf = (side: string, round: number) =>
			state.matches.find((m) => m.side === side && m.round === round)?.bestOf;
		expect([1, 2, 3].map((r) => bestOf("upper", r))).toEqual([3, 3, 5]);
		expect([1, 2, 3, 4].map((r) => bestOf("lower", r))).toEqual([3, 3, 5, 5]);
		expect(bestOf("final", 1)).toBe(5);
	});

	it("rejects a Bo list that does not match the rounds", () => {
		expect(() => single(8, bo(2))).toThrow(RangeError);
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

describe("properties", () => {
	const results = fc.array(fc.boolean(), { minLength: 64, maxLength: 64 });
	const picker = (flags: boolean[]) => {
		let i = 0;
		return () => flags[i++ % flags.length] as boolean;
	};

	it("single elim: one champion and every other team loses exactly once", () => {
		fc.assert(
			fc.property(fc.integer({ min: 2, max: 32 }), results, (size, flags) => {
				let rounds = 0;
				for (let p = 1; p < size; p *= 2) rounds += 1;
				const teams = teamsOf(size);
				const state = play(single(size, bo(rounds)), teams, picker(flags));
				expect(state.champion).not.toBeNull();
				for (const t of teams) {
					expect(state.losses[t] ?? 0).toBe(t === state.champion ? 0 : 1);
				}
				// Every series is played once: size - 1 matches.
				expect(state.matches.filter((m) => m.status === "done")).toHaveLength(
					size - 1,
				);
			}),
		);
	});

	it("double elim: one champion; the others lose twice (the upper-side runner-up once)", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...DOUBLE_CASES),
				fc.boolean(),
				results,
				([size, upper, drop, lower], reset, flags) => {
					const teams = teamsOf(size);
					const bracket = double(size, upper, drop, lower, { reset });
					const state = play(bracket, teams, picker(flags));
					const final = state.matches.find((m) => m.id === "GF");
					const reseted = state.matches.find((m) => m.id === "RS");
					expect(state.champion).not.toBeNull();
					expect(state.matches.every((m) => m.status !== "ready")).toBe(true);
					for (const t of teams) {
						const lost = state.losses[t] ?? 0;
						if (t === state.champion) {
							expect(lost).toBeLessThanOrEqual(1);
						} else if (final?.teamA === t && reseted?.status !== "done") {
							// Upper-side finalist lost the final only.
							expect(lost).toBe(1);
						} else {
							expect(lost).toBe(2);
						}
					}
				},
			),
		);
	});

	it("every team plays at most one match at a time (no team in two ready matches)", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...DOUBLE_CASES),
				results,
				([size, upper, drop, lower], flags) => {
					const teams = teamsOf(size);
					const bracket = double(size, upper, drop, lower);
					const next = picker(flags);
					const done: Record<string, string> = {};
					for (;;) {
						const state = resolveBracket(bracket, teams, done);
						const ready = state.matches.filter((m) => m.status === "ready");
						const seen = ready.flatMap((m) => [m.teamA, m.teamB]);
						expect(new Set(seen).size).toBe(seen.length);
						const m = ready[0];
						if (!m) break;
						done[m.id] = (next() ? m.teamA : m.teamB) as string;
					}
				},
			),
		);
	});

	it("never repeats the pairing of the previous round in the lower bracket", () => {
		for (const [size, upper, drop, lower] of DOUBLE_CASES) {
			const bracket = double(size, upper, drop, lower);
			const teams = teamsOf(size);
			fc.assert(
				fc.property(results, (flags) => {
					const state = play(bracket, teams, picker(flags));
					const seen = new Set<string>();
					for (const m of state.matches.filter((x) => x.side === "lower")) {
						const key = [m.teamA, m.teamB].sort().join("-");
						// A lower pairing may repeat an upper one only after a drop in
						// the same bracket, never within the lower side.
						expect(seen.has(key)).toBe(false);
						seen.add(key);
					}
				}),
			);
		}
	});
});

describe("B3b: drops per series, eliminations and lower entrants", () => {
	it("sends the two round 2 losers to different lower rounds (LCK 6)", () => {
		const bracket = double(6, 3, [[0, 0], [1, 2], [3]], 4);
		const lower = (round: number) =>
			bracket.matches.filter((m) => m.side === "lower" && m.round === round);
		expect(lower(2)).toHaveLength(1);
		expect(lower(2)[0]).toMatchObject({
			a: { kind: "winner", match: "L1-1" },
			b: { kind: "loser", match: "U2-1" },
		});
		expect(lower(3)[0]).toMatchObject({
			a: { kind: "winner", match: "L2-1" },
			b: { kind: "loser", match: "U2-2" },
		});
		expect(lower(4)[0]?.b).toEqual({ kind: "loser", match: "U3-1" });
	});

	it("eliminates the losers whose drop is null and never plays them again (LCP 6)", () => {
		const bracket = double(6, 3, [[null, null], [0, 0], [1]], 2);
		const state = play(bracket, teamsOf(6), (a, b) => a < b);
		const out = ["t5", "t6"];
		for (const t of out) expect(state.losses[t]).toBe(1);
		const lowerTeams = state.matches
			.filter((m) => m.side === "lower")
			.flatMap((m) => [m.teamA, m.teamB]);
		for (const t of out) expect(lowerTeams).not.toContain(t);
	});

	it("brings the worst seeds into the lower bracket in the rounds the format sets (King of the Hill)", () => {
		const bracket = double(6, 1, [[3]], 4, { lowerSeeds: [2, 1, 1, 0] });
		const state = resolveBracket(bracket, teamsOf(6), {});
		const lower = (round: number) =>
			state.matches.find((m) => m.side === "lower" && m.round === round);
		expect([lower(1)?.teamA, lower(1)?.teamB].sort()).toEqual(["t5", "t6"]);
		expect(lower(2)?.teamB).toBe("t4");
		expect(lower(3)?.teamB).toBe("t3");
		expect(state.matches.find((m) => m.id === "U1-1")).toMatchObject({
			teamA: "t1",
			teamB: "t2",
		});
	});

	it("rejects a size that does not match its lower entrants", () => {
		expect(() =>
			double(6, 2, [[0, 0], [2]], 3, { lowerSeeds: [3, 0, 0] }),
		).toThrow(RangeError);
		expect(() => double(6, 1, [[3]], 4, { lowerSeeds: [2, 1, 1, 1] })).toThrow(
			RangeError,
		);
	});
});

/** The real 2026 double eliminations (plan 12, formats study). */
const REAL_2026: [string, DoubleElim][] = [
	[
		"LCK playoffs and Cup, LCS Summer, CBLOL: 6 teams, round 2 losers split",
		fmt(6, 3, [[0, 0], [1, 2], [3]], 4),
	],
	[
		"LCP splits: 6 teams, round 1 losers out",
		fmt(6, 3, [[null, null], [0, 0], [1]], 2),
	],
	[
		"LEC Spring and Summer, LCS Spring: 4 upper + seeds 5 and 6 below",
		fmt(6, 2, [[0, 0], [2]], 3, { lowerSeeds: [2, 0, 0] }),
	],
	[
		"standard 8 (LPL splits, LEC Versus, MSI)",
		fmt(8, 3, [[0, 0, 0, 0], [1, 1], [3]], 4),
	],
	["MSI and Worlds play-in: 4 teams", fmt(4, 2, [[0, 0], [1]], 2)],
	[
		"LPL Grand Finals: 6 upper + 2 Knight's Road winners below",
		fmt(8, 3, [[0, 0], [1, 1], [3]], 4, { lowerSeeds: [2, 0, 0, 0] }),
	],
	[
		"LCK Road to MSI: King of the Hill",
		fmt(6, 1, [[3]], 4, { lowerSeeds: [2, 1, 1, 0] }),
	],
];

describe("real 2026 brackets", () => {
	it.each(REAL_2026)("%s builds and always ends with one champion", (_n, f) => {
		const bracket = buildDoubleElim(f);
		const teams = teamsOf(f.size);
		fc.assert(
			fc.property(
				fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
				(flags) => {
					let i = 0;
					const state = play(bracket, teams, () => flags[i++ % 40] as boolean);
					expect(state.champion).not.toBeNull();
					expect(
						state.matches.every(
							(m) => m.status === "done" || m.status === "skipped",
						),
					).toBe(true);
					for (const t of teams) {
						if (t !== state.champion) {
							expect(state.losses[t] ?? 0).toBeGreaterThanOrEqual(1);
						}
					}
				},
			),
		);
	});
});
