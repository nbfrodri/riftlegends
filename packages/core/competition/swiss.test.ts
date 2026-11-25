import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { drawGame1Priority } from "./round-robin";
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
	test("Q4: separates teams of one league even when their regions differ", () => {
		const teams = teamsOf(8, (index) => `region-${index}`).map(
			(team, index) => ({
				...team,
				league: index % 2 === 0 ? "A" : "B",
			}),
		);
		const leagueOf = new Map(teams.map(({ id, league }) => [id, league]));
		for (const seed of [1, 2, 3, 4]) {
			const round = pairSwissRound(teams, [], RULES, seed, SCOPE);
			expect(round?.relaxed).toEqual([]);
			expect(round?.pairings).toHaveLength(4);
			for (const { a, b } of round?.pairings ?? []) {
				expect(leagueOf.get(a)).not.toBe(leagueOf.get(b));
			}
		}
	});

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

describe("pairSwissRound later rounds", () => {
	test("S1: each round pairs teams with the same record", () => {
		const teams = teamsOf(16);
		const { rounds, played } = play(teams, (r, i) => (r + i) % 2);
		expect(rounds.length).toBeGreaterThanOrEqual(4);
		for (const [index, round] of rounds.slice(1).entries()) {
			const rows = swissStandings(teams, played.slice(0, index + 1), RULES);
			const row = (id: string) => rows.find((r) => r.id === id);
			expect(round.pairings.length).toBeGreaterThan(0);
			for (const { a, b, reason } of round.pairings) {
				expect(reason).toBe("same-record");
				expect(row(a)?.wins).toBe(row(b)?.wins);
				expect(row(a)?.losses).toBe(row(b)?.losses);
			}
		}
	});

	test("S8: within a record pool the draw is seeded, so seeds 1 and 2 do not always meet", () => {
		const teams = teamsOf(16);
		const draws = new Set<string>();
		const t1Rivals = new Set<string>();
		for (let seed = 0; seed < 30; seed++) {
			const { played } = play(teams, () => 0, seed);
			const round2 = pairSwissRound(
				teams,
				played.slice(0, 1),
				RULES,
				seed,
				SCOPE,
			);
			draws.add(round2?.pairings.map((p) => `${p.a}-${p.b}`).join(",") ?? "");
			const first = round2?.pairings.find((p) => p.a === "t1" || p.b === "t1");
			t1Rivals.add(first?.a === "t1" ? first.b : (first?.a ?? ""));
			// same seed, same draw
			const again = pairSwissRound(
				teams,
				played.slice(0, 1),
				RULES,
				seed,
				SCOPE,
			);
			expect(again).toEqual(round2);
		}
		expect(draws.size).toBeGreaterThan(10);
		expect(t1Rivals.size).toBeGreaterThan(2);
	});

	test("S2: never a rematch when a pairing without one exists", () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: 0, max: 1 }), {
					minLength: 80,
					maxLength: 80,
				}),
				(bits) => {
					const { played, rounds } = play(
						teamsOf(16),
						(r, i) => bits[r * 8 + i] as number,
					);
					const met = new Set<string>();
					for (const [index, round] of rounds.entries()) {
						if (!round.relaxed.includes("rematch")) {
							for (const { a, b } of round.pairings) {
								expect(met.has(key(a, b))).toBe(false);
							}
						}
						for (const { winner, loser } of played[index] ?? []) {
							met.add(key(winner, loser));
						}
					}
				},
			),
		);
	});
});

describe("pairSwissRound best of", () => {
	test("S4: Bo1 in general, Bo3 when a win qualifies or a loss eliminates", () => {
		const teams = teamsOf(16);
		const { rounds, played } = play(teams, () => 0);
		expect(rounds.length).toBeGreaterThanOrEqual(5);
		for (const [index, round] of rounds.entries()) {
			const before = swissStandings(teams, played.slice(0, index), RULES);
			for (const { a, b, bestOf } of round.pairings) {
				const decisive = [a, b].some((id) => {
					const row = before.find((r) => r.id === id);
					return row?.wins === 2 || row?.losses === 2;
				});
				expect(bestOf).toBe(decisive ? 3 : 1);
			}
		}
		expect(rounds[0]?.pairings.every((p) => p.bestOf === 1)).toBe(true);
		expect(rounds[2]?.pairings.some((p) => p.bestOf === 3)).toBe(true);
	});

	test("S4: the Bo values come from the format", () => {
		const rules = {
			...RULES,
			wins: 2,
			losses: 2,
			bestOf: 3,
			decisiveBestOf: 5,
		};
		const { rounds } = play(teamsOf(8), () => 0, 1, rules);
		expect(rounds[0]?.pairings.every((p) => p.bestOf === 3)).toBe(true);
		expect(rounds[1]?.pairings.every((p) => p.bestOf === 5)).toBe(true);
	});
});

describe("pairSwissRound game 1 priority", () => {
	test("S8: priority is drawn with the competition stream, one coin per series", () => {
		const teams = teamsOf(16);
		const priorities = new Set<string>();
		for (let seed = 0; seed < 20; seed++) {
			const round = pairSwissRound(teams, [], RULES, seed, SCOPE);
			const expected = drawGame1Priority(
				seed,
				{ ...SCOPE, round: 1 },
				round?.pairings.map(({ a, b }) => ({ a, b })) ?? [],
			);
			expect(round?.pairings.map((p) => p.priority)).toEqual(expected);
			for (const { a, priority } of round?.pairings ?? []) {
				priorities.add(priority === a ? "a" : "b");
			}
		}
		expect(priorities.size).toBe(2);
	});
});

describe("pairSwissRound relaxation", () => {
	test("S6: with no pairing that keeps the regions apart, region is dropped first and recorded", () => {
		const round = pairSwissRound(
			teamsOf(8, () => "LCK"),
			[],
			RULES,
			1,
			SCOPE,
		);
		expect(round?.relaxed).toEqual(["region"]);
		expect(round?.pairings).toHaveLength(4);
	});

	test("S6: with every equal-record pair already met, rematch is dropped next and recorded", () => {
		const teams = teamsOf(4, () => undefined);
		const played = [
			[
				{ winner: "t1", loser: "t2" },
				{ winner: "t3", loser: "t4" },
			],
			[
				{ winner: "t1", loser: "t3" },
				{ winner: "t2", loser: "t4" },
			],
			[
				{ winner: "t4", loser: "t1" },
				{ winner: "t2", loser: "t3" },
			],
		];
		const rules = { ...RULES, wins: 4, losses: 4 };
		const round = pairSwissRound(teams, played, rules, 1, SCOPE);
		expect(round?.relaxed).toEqual(["rematch"]);
		expect(round?.pairings.map((p) => `${p.a}-${p.b}`)).toEqual([
			"t1-t2",
			"t3-t4",
		]);
		const noRules = pairSwissRound(
			teams,
			played,
			{ ...rules, avoid: [] },
			1,
			SCOPE,
		);
		expect(noRules?.relaxed).toEqual([]);
	});

	test("S1: an odd record pool sends one team to the neighbour pool as a last resort, recorded", () => {
		const teams = teamsOf(6, () => undefined);
		const round1 = pairSwissRound(teams, [], RULES, 5, SCOPE);
		const played = [
			(round1?.pairings ?? []).map(({ a, b }) => ({ winner: a, loser: b })),
		];
		const round2 = pairSwissRound(teams, played, RULES, 5, SCOPE);
		expect(round2?.relaxed).toEqual(["record"]);
		const reasons = round2?.pairings.map((p) => p.reason).sort();
		expect(reasons).toEqual(["cross-record", "same-record", "same-record"]);
		const cross = round2?.pairings.find((p) => p.reason === "cross-record");
		const winners = new Set(round1?.pairings.map((p) => p.a));
		expect(
			[cross?.a, cross?.b].filter((id) => winners.has(id as string)),
		).toHaveLength(1);
	});
});

describe("whole Swiss stage", () => {
	const results = fc.array(fc.integer({ min: 0, max: 1 }), {
		minLength: 80,
		maxLength: 80,
	});

	test("S5: 16 teams at 3-3 always send exactly 8 in at most 5 rounds, never crossing records", () => {
		fc.assert(
			fc.property(results, fc.integer({ min: 0, max: 1000 }), (bits, seed) => {
				const { rounds, rows } = play(
					teamsOf(16),
					(r, i) => bits[r * 8 + i] as number,
					seed,
				);
				expect(rounds.length).toBeLessThanOrEqual(5);
				expect(rows.filter((row) => row.status === "qualified")).toHaveLength(
					8,
				);
				expect(rows.filter((row) => row.status === "eliminated")).toHaveLength(
					8,
				);
				for (const round of rounds) {
					expect(round.relaxed).not.toContain("record");
					expect(round.pairings.every((p) => p.reason !== "cross-record")).toBe(
						true,
					);
				}
			}),
		);
	});

	test("S7: any result sequence pairs and finishes, for 8 and 16 teams and any regions", () => {
		const shapes = [
			{ n: 16, rules: RULES },
			{ n: 8, rules: RULES },
			{ n: 8, rules: { ...RULES, wins: 2, losses: 2 } },
		];
		for (const { n, rules } of shapes) {
			fc.assert(
				fc.property(results, fc.boolean(), (bits, oneRegion) => {
					const teams = teamsOf(n, oneRegion ? () => "LCK" : undefined);
					const { rounds, rows } = play(
						teams,
						(r, i) => bits[r * 8 + i] as number,
						7,
						rules,
					);
					expect(rounds.length).toBeLessThanOrEqual(
						rules.wins + rules.losses - 1,
					);
					expect(rows.every((row) => row.status !== "active")).toBe(true);
					for (const round of rounds) {
						const ids = round.pairings.flatMap(({ a, b }) => [a, b]);
						expect(new Set(ids).size).toBe(ids.length);
					}
				}),
			);
		}
	});

	test("rejects an odd number of teams", () => {
		expect(() => pairSwissRound(teamsOf(5), [], RULES, 1, SCOPE)).toThrow(
			/even number of teams/,
		);
	});
});
