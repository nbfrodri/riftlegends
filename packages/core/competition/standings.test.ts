import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
	computeStandings,
	type Criterion,
	type SeriesResult,
	type StandingsInput,
} from "./standings";

const SCOPE = { competition: 1, season: 2, stage: 3 };

/** `winner` beats `loser` 2-`loserGames`. */
const w = (winner: string, loser: string, loserGames = 0): SeriesResult => ({
	a: winner,
	b: loser,
	winsA: 2,
	winsB: loserGames,
});

const input = (
	teams: string[],
	results: SeriesResult[],
	criteria: Criterion[],
	extra: Partial<StandingsInput> = {},
): StandingsInput => ({
	teams,
	results,
	criteria,
	cuts: [],
	rootSeed: 7,
	scope: SCOPE,
	...extra,
});
const teamsOf = (i: StandingsInput) =>
	computeStandings(i).rows.map((row) => row.team);

describe("D1 criteria in order", () => {
	test("series wins decide first and the row carries the record", () => {
		const results = [
			w("A", "C"),
			w("B", "C", 1),
			w("D", "A"),
			w("D", "B"),
			w("D", "C"),
			w("A", "B"),
		];
		const { rows } = computeStandings(
			input(["A", "B", "C", "D"], results, ["seriesWins"]),
		);
		expect(rows.map((row) => row.team)).toEqual(["D", "A", "B", "C"]);
		expect(rows[0]).toMatchObject({
			rank: 1,
			seriesWins: 3,
			seriesLosses: 0,
			gameWins: 6,
			gameLosses: 0,
		});
	});

	test("game difference splits teams level on series wins", () => {
		// A, B and C each win one series; game differences are 0, +1 and -1.
		const results = [w("A", "B", 1), w("B", "C"), w("C", "A", 1)];
		const { rows } = computeStandings(
			input(["A", "B", "C"], results, ["seriesWins", "gameDiff"]),
		);
		expect(rows.map((row) => row.team)).toEqual(["B", "A", "C"]);
		expect(rows[0]?.explanation).toEqual({
			criterion: "gameDiff",
			tied: ["A", "B", "C"],
			values: { A: 0, B: 1, C: -1 },
		});
	});

	test("an unknown team, a duplicate team or a drawn series is rejected", () => {
		const criteria: Criterion[] = ["seriesWins"];
		expect(() =>
			computeStandings(input(["A", "B"], [w("A", "Z")], criteria)),
		).toThrow(RangeError);
		expect(() => computeStandings(input(["A", "A"], [], criteria))).toThrow(
			RangeError,
		);
		const drawn = { a: "A", b: "B", winsA: 1, winsB: 1 };
		expect(() =>
			computeStandings(input(["A", "B"], [drawn], criteria)),
		).toThrow(RangeError);
	});
});

describe("D2 head to head minitable", () => {
	const criteria: Criterion[] = ["seriesWins", "headToHead"];

	test("two teams level on series wins are split by their own series", () => {
		// A and B win two series each; B beat A.
		const results = [
			w("B", "A"),
			w("A", "C"),
			w("A", "D"),
			w("B", "C"),
			w("D", "B"),
		];
		const { rows } = computeStandings(
			input(["A", "B", "C", "D"], results, criteria),
		);
		expect(rows.map((row) => row.team)).toEqual(["B", "A", "D", "C"]);
		expect(rows[0]?.explanation).toEqual({
			criterion: "headToHead",
			tied: ["A", "B"],
			values: { A: 0, B: 1 },
		});
	});

	test("a three-way tie uses one minitable of the three and ignores other series", () => {
		// A, B and C win two series each; E beats the lot, D only beats A.
		const results = [
			w("A", "B"),
			w("A", "C"),
			w("D", "A"),
			w("E", "A"),
			w("B", "C"),
			w("B", "D"),
			w("E", "B"),
			w("C", "D"),
			w("C", "E"),
			w("E", "D"),
		];
		const { rows } = computeStandings(
			input(["A", "B", "C", "D", "E"], results, criteria),
		);
		expect(rows.map((row) => row.team)).toEqual(["E", "A", "B", "C", "D"]);
		expect(rows[1]?.explanation).toEqual({
			criterion: "headToHead",
			tied: ["A", "B", "C"],
			values: { A: 2, B: 1, C: 0 },
		});
	});

	test("a cyclic minitable separates nobody and falls to the draw", () => {
		const results = [w("A", "B"), w("B", "C"), w("C", "A")];
		const { rows } = computeStandings(
			input(["A", "B", "C"], results, [...criteria, "draw"]),
		);
		expect(rows.every((row) => row.explanation.criterion === "draw")).toBe(
			true,
		);
	});
});

describe("D3 restart from the first criterion", () => {
	test("a criterion that splits only part of the tie restarts for each part", () => {
		// A, B, C and D win two series each (X loses to B and C). The minitable of
		// the four is A 2, D 2, B 1, C 1, so it only splits {A, D} from {B, C};
		// each pair then gets its own minitable.
		const results = [
			w("A", "B"),
			w("A", "C"),
			w("D", "A"),
			w("B", "C"),
			w("D", "B"),
			w("C", "D"),
			w("B", "X"),
			w("C", "X"),
		];
		const { rows } = computeStandings(
			input(["A", "B", "C", "D", "X"], results, ["seriesWins", "headToHead"]),
		);
		expect(rows.map((row) => row.team)).toEqual(["D", "A", "B", "C", "X"]);
		expect(rows[0]?.explanation).toEqual({
			criterion: "headToHead",
			tied: ["A", "D"],
			values: { A: 0, D: 1 },
		});
		expect(rows[2]?.explanation).toEqual({
			criterion: "headToHead",
			tied: ["B", "C"],
			values: { B: 1, C: 0 },
		});
	});
});

describe("D4 tiebreaker series at a cut", () => {
	const criteria: Criterion[] = ["seriesWins", "tiebreakerSeries", "draw"];
	// A wins everything; B and D win one series each (positions 2 and 3); C none.
	const league = [
		w("A", "B"),
		w("A", "C"),
		w("A", "D"),
		w("B", "C"),
		w("D", "B"),
	];
	const teams = ["A", "B", "C", "D"];

	test("a tie across a cut asks for one series between the two teams", () => {
		const out = computeStandings(input(teams, league, criteria, { cuts: [2] }));
		expect(out.pending).toEqual([{ a: "B", b: "D" }]);
		expect(out.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
	});

	test("a tie that touches no cut is never played: the draw decides", () => {
		for (const cuts of [[], [1], [3]]) {
			const out = computeStandings(input(teams, league, criteria, { cuts }));
			expect(out.pending).toEqual([]);
			expect(out.rows[1]?.explanation.criterion).toBe("draw");
		}
	});

	test("the played tiebreaker decides and becomes the explanation", () => {
		const out = computeStandings(
			input(teams, league, criteria, {
				cuts: [2],
				tiebreakerResults: [w("D", "B", 1)],
			}),
		);
		expect(out.pending).toEqual([]);
		expect(out.rows.map((row) => row.team)).toEqual(["A", "D", "B", "C"]);
		expect(out.rows[1]?.explanation).toEqual({
			criterion: "tiebreakerSeries",
			tied: ["B", "D"],
			values: { B: 0, D: 1 },
		});
	});

	describe("a three-way tie at a cut", () => {
		// A, B and C win two series each in a cycle plus D; the cut is after 2.
		const cycle = [
			w("A", "B"),
			w("B", "C"),
			w("C", "A"),
			w("A", "D"),
			w("B", "D"),
			w("C", "D"),
		];
		const run = (tiebreakerResults: SeriesResult[]) =>
			computeStandings(
				input(["A", "B", "C", "D"], cycle, criteria, {
					cuts: [2],
					tiebreakerResults,
				}),
			);

		test("schedules every pair that has not been played", () => {
			expect(run([]).pending).toEqual([
				{ a: "A", b: "B" },
				{ a: "A", b: "C" },
				{ a: "B", b: "C" },
			]);
			expect(run([w("A", "B")]).pending).toEqual([
				{ a: "A", b: "C" },
				{ a: "B", b: "C" },
			]);
		});

		test("ranks by tiebreaker wins once every pair is played", () => {
			const out = run([w("C", "A"), w("C", "B"), w("B", "A")]);
			expect(out.pending).toEqual([]);
			expect(out.rows.map((row) => row.team)).toEqual(["C", "B", "A", "D"]);
			expect(out.rows[0]?.explanation).toEqual({
				criterion: "tiebreakerSeries",
				tied: ["A", "B", "C"],
				values: { A: 0, B: 1, C: 2 },
			});
		});
	});
});

describe("D5 final draw", () => {
	const cycle = [w("A", "B"), w("B", "C"), w("C", "A")];
	const run = (
		rootSeed: number,
		criteria: Criterion[] = ["seriesWins", "draw"],
	) => input(["A", "B", "C"], cycle, criteria, { rootSeed });

	test("the same seed gives the same order", () => {
		expect(teamsOf(run(5))).toEqual(teamsOf(run(5)));
	});

	test("different seeds give different orders", () => {
		const orders = new Set(
			Array.from({ length: 30 }, (_, seed) => teamsOf(run(seed)).join()),
		);
		expect(orders.size).toBeGreaterThan(1);
	});

	test("a draw settles what is left even if the list does not name one", () => {
		const { rows } = computeStandings(run(5, ["seriesWins"]));
		expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
		expect(rows[0]?.explanation.criterion).toBe("draw");
		expect(rows[0]?.explanation.tied).toEqual(["A", "B", "C"]);
	});
});

describe("D6 explanation", () => {
	test("each row names the deciding criterion, who was tied and their values", () => {
		const results = [w("A", "B"), w("A", "C"), w("B", "C")];
		const { rows } = computeStandings(
			input(["A", "B", "C"], results, ["seriesWins"]),
		);
		for (const row of rows) {
			expect(row.explanation).toEqual({
				criterion: "seriesWins",
				tied: ["A", "B", "C"],
				values: { A: 2, B: 1, C: 0 },
			});
		}
	});

	test("a lone team has nothing to explain", () => {
		const { rows } = computeStandings(input(["A"], [], ["seriesWins"]));
		expect(rows[0]?.explanation).toEqual({
			criterion: "none",
			tied: [],
			values: {},
		});
	});
});

describe("D7 total order", () => {
	const names = ["T1", "T2", "T3", "T4", "T5", "T6"];
	const all: Criterion[] = [
		"seriesWins",
		"gameDiff",
		"headToHead",
		"gameWins",
		"tiebreakerSeries",
		"draw",
	];

	test("any results give a permutation of the teams with ranks 1..n", () => {
		const series = fc.record({
			a: fc.constantFrom(...names),
			b: fc.constantFrom(...names),
			loserGames: fc.constantFrom(0, 1),
			aWon: fc.boolean(),
		});
		fc.assert(
			fc.property(
				fc.array(series, { maxLength: 30 }),
				fc.integer({ min: 0, max: 2 ** 32 - 1 }),
				fc.uniqueArray(fc.integer({ min: 1, max: 5 }), { maxLength: 3 }),
				(raw, rootSeed, cuts) => {
					const results = raw
						.filter(({ a, b }) => a !== b)
						.map(({ a, b, loserGames, aWon }) => ({
							a,
							b,
							winsA: aWon ? 2 : loserGames,
							winsB: aWon ? loserGames : 2,
						}));
					const out = computeStandings(
						input(names, results, all, { rootSeed, cuts }),
					);
					expect(out.rows.map((row) => row.team).sort()).toEqual([...names]);
					expect(out.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
				},
			),
		);
	});
});
