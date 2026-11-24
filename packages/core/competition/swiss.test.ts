import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
	pairSwissRound,
	type SwissResult,
	type SwissRules,
	type SwissTeam,
	swissStandings,
} from "./swiss";

const RULES: SwissRules = {
	wins: 3,
	losses: 3,
	bestOf: 1,
	decisiveBestOf: 3,
	avoid: ["region", "rematch"],
};
const SCOPE = { competition: 1, season: 2, stage: 3 };
const regions = ["LCK", "LPL", "LEC", "LCP"];
const teamsOf = (
	n: number,
	region: (i: number) => string | undefined = (i) => regions[i % 4],
): SwissTeam[] =>
	Array.from({ length: n }, (_, i) => {
		const id = `t${i + 1}`;
		const r = region(i);
		return r === undefined ? { id } : { id, region: r };
	});
const key = (a: string, b: string) => [a, b].sort().join("|");

/** Plays a whole stage; `pick(round, index)` is 0 when `a` wins and 1 when `b` wins. */
function play(
	teams: SwissTeam[],
	pick: (round: number, index: number) => number,
	seed = 1,
	rules = RULES,
) {
	const played: SwissResult[][] = [];
	const rounds = [];
	for (;;) {
		const round = pairSwissRound(teams, played, rules, seed, SCOPE);
		if (round === null) break;
		rounds.push(round);
		played.push(
			round.pairings.map(({ a, b }, index) =>
				pick(round.round, index) === 0
					? { winner: a, loser: b }
					: { winner: b, loser: a },
			),
		);
	}
	return { played, rounds, rows: swissStandings(teams, played, rules) };
}

describe("swissStandings", () => {
	test("counts wins and losses and marks qualified and eliminated teams", () => {
		const teams = teamsOf(4, () => undefined);
		const played = [
			[
				{ winner: "t1", loser: "t2" },
				{ winner: "t3", loser: "t4" },
			],
			[
				{ winner: "t1", loser: "t3" },
				{ winner: "t4", loser: "t2" },
			],
		];
		expect(swissStandings(teams, played, { wins: 2, losses: 2 })).toEqual([
			{ id: "t1", wins: 2, losses: 0, status: "qualified" },
			{ id: "t2", wins: 0, losses: 2, status: "eliminated" },
			{ id: "t3", wins: 1, losses: 1, status: "active" },
			{ id: "t4", wins: 1, losses: 1, status: "active" },
		]);
	});

	test("rejects a result with an unknown team", () => {
		expect(() =>
			swissStandings(teamsOf(2), [[{ winner: "x", loser: "t1" }]], RULES),
		).toThrow(RangeError);
	});
});

const pot = (id: string) =>
	(Number(id.slice(1)) - 1 - ((Number(id.slice(1)) - 1) % 4)) / 4;

describe("pairSwissRound round 1", () => {
	test("S3: pots meet 1 v 4 and 2 v 3", () => {
		const round = pairSwissRound(
			teamsOf(16, () => undefined),
			[],
			RULES,
			1,
			SCOPE,
		);
		expect(round?.round).toBe(1);
		expect(round?.pairings).toHaveLength(8);
		const ids = round?.pairings.flatMap(({ a, b }) => [a, b]) ?? [];
		expect(new Set(ids).size).toBe(16);
		for (const { a, b, reason } of round?.pairings ?? []) {
			expect(pot(a) + pot(b)).toBe(3);
			expect(Number(a.slice(1))).toBeLessThan(Number(b.slice(1)));
			expect(reason).toBe("pots");
		}
	});

	test("S3: round 1 never pairs teams of the same region", () => {
		const teams = teamsOf(16);
		const round = pairSwissRound(teams, [], RULES, 1, SCOPE);
		expect(round?.relaxed).toEqual([]);
		for (const { a, b } of round?.pairings ?? []) {
			expect(teams.find((t) => t.id === a)?.region).not.toBe(
				teams.find((t) => t.id === b)?.region,
			);
			expect(pot(a) + pot(b)).toBe(3);
		}
	});

	test("S8: the same seed gives the same draw and other seeds or stages give others", () => {
		const draw = (seed: number, stage = SCOPE.stage) =>
			pairSwissRound(teamsOf(16), [], RULES, seed, { ...SCOPE, stage })
				?.pairings.map((p) => `${p.a}-${p.b}`)
				.join(",");
		expect(draw(9)).toEqual(draw(9));
		expect(
			new Set(Array.from({ length: 20 }, (_, seed) => draw(seed))).size,
		).toBeGreaterThan(10);
		expect(draw(9, 4)).not.toEqual(draw(9));
	});
});
