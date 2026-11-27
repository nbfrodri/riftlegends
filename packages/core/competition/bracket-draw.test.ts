import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRng } from "../rng/streams";
import { buildDoubleElim, buildSingleElim } from "./bracket";
import { type BracketDrawRules, drawBracket } from "./bracket-draw";
import { resolveBracket } from "./bracket-state";

// Plan 12 §6: bracket draws as stage data (#626).

const field = (regions: readonly string[]) =>
	regions.map((region, index) => ({
		team: `t${index + 1}`,
		region,
		initialSeed: index + 1,
	}));
const never = () => false;
const SEEDS = Array.from({ length: 64 }, (_, i) => i * 7919 + 1);
const run = (
	rules: BracketDrawRules,
	teams: ReturnType<typeof field>,
	seed: number,
	met: (a: string, b: string) => boolean = never,
) => drawBracket(rules, teams, met, createRng(seed));
const tierOf = (rules: BracketDrawRules, team: string) =>
	rules.tiers.findIndex((tier) => tier.includes(Number(team.slice(1)))) + 1;
const half = (order: readonly string[], team: string) =>
	// Seeds 1, 8, 4 and 5 make the top half of a bracket of 8 (1-8, 4-5, 2-7, 3-6).
	[1, 4, 5, 8].includes(order.indexOf(team) + 1) ? "top" : "bottom";

const msi: BracketDrawRules = {
	tiers: [
		[1, 2],
		[3, 4],
		[5, 6],
		[7, 8],
	],
	meet: [
		[1, 4],
		[2, 3],
	],
	avoid: ["regionHalf"],
};
// The entry list is the Swiss from 1 to 8: 3-0 (1-2), 3-1 (3-5) and 3-2 (6-8).
const quarters: BracketDrawRules = {
	tiers: [
		[1, 2],
		[3, 4, 5],
		[6, 7, 8],
	],
	meet: [[1, 3]],
	avoid: ["rematch"],
};
const msiField = field([
	"LCK",
	"LPL",
	"LEC",
	"LCS",
	"LCP",
	"CBLOL",
	"LCK",
	"LPL",
]);

describe("drawBracket", () => {
	it("SO1: the same stream gives the same draw, other seeds can change it", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
				expect(run(msi, msiField, seed)).toEqual(run(msi, msiField, seed));
			}),
		);
		const draws = new Set(
			SEEDS.map((seed) => JSON.stringify(run(msi, msiField, seed).pairs)),
		);
		expect(draws.size).toBeGreaterThan(1);
	});

	it("SO3: MSI crosses tier 1 with tier 4 and tier 2 with tier 3", () => {
		for (const seed of SEEDS) {
			for (const pair of run(msi, msiField, seed).pairs) {
				const tiers = pair.map((team) => tierOf(msi, team)).sort();
				expect([
					[1, 4],
					[2, 3],
				]).toContainEqual(tiers);
			}
		}
	});

	it("SO3: Worlds quarterfinals cross both 3-0 with 3-2 and the spare 3-2 with a 3-1", () => {
		const teams = field(["A", "B", "C", "D", "E", "F", "G", "H"]);
		for (const seed of SEEDS) {
			const pairs = run(quarters, teams, seed).pairs.map((pair) =>
				pair.map((team) => tierOf(quarters, team)).sort(),
			);
			expect(pairs.filter(([a, b]) => a === 1 && b === 3)).toHaveLength(2);
			expect(pairs.filter(([a, b]) => a === 2 && b === 3)).toHaveLength(1);
			expect(pairs.filter(([a, b]) => a === 2 && b === 2)).toHaveLength(1);
		}
	});

	it("SO4: regionHalf puts teams of the same region in opposite halves", () => {
		for (const seed of SEEDS) {
			const { order, relaxed } = run(msi, msiField, seed);
			expect(relaxed).toEqual([]);
			expect(half(order, "t1")).not.toBe(half(order, "t7"));
			expect(half(order, "t2")).not.toBe(half(order, "t8"));
		}
	});

	it("SO4 and SO7: three teams of a region in a bracket of 4 relax regionHalf only", () => {
		const rules: BracketDrawRules = {
			tiers: [
				[1, 2],
				[3, 4],
			],
			meet: [[1, 2]],
			avoid: ["regionHalf"],
		};
		for (const seed of SEEDS.slice(0, 16)) {
			const { pairs, relaxed } = run(
				rules,
				field(["LCK", "LCK", "LCK", "LPL"]),
				seed,
			);
			expect(relaxed).toEqual(["regionHalf"]);
			for (const pair of pairs)
				expect(pair.map((team) => tierOf(rules, team)).sort()).toEqual([1, 2]);
		}
	});

	it("SO5: region keeps teams of the same region apart in the first round", () => {
		const rules: BracketDrawRules = {
			tiers: [[1, 2, 3, 4, 5, 6, 7, 8]],
			meet: [],
			avoid: ["region"],
		};
		const teams = field(["A", "A", "B", "B", "C", "C", "D", "D"]);
		for (const seed of SEEDS) {
			const { pairs, relaxed } = run(rules, teams, seed);
			expect(relaxed).toEqual([]);
			for (const [a, b] of pairs)
				expect(teams.find((t) => t.team === a)?.region).not.toBe(
					teams.find((t) => t.team === b)?.region,
				);
		}
	});

	it("SO6: rematch avoids Swiss rivals whenever another draw exists", () => {
		const teams = field(["A", "B", "C", "D", "E", "F", "G", "H"]);
		const rivals = new Set(["t1|t6", "t1|t7", "t2|t8"]);
		const met = (a: string, b: string) =>
			rivals.has(`${a}|${b}`) || rivals.has(`${b}|${a}`);
		for (const seed of SEEDS) {
			const { pairs, relaxed } = run(quarters, teams, seed, met);
			expect(relaxed).toEqual([]);
			for (const [a, b] of pairs) expect(met(a, b)).toBe(false);
		}
	});

	it("SO7: a 3-0 that met all three 3-2 relaxes rematch but keeps meet", () => {
		const teams = field(["A", "B", "C", "D", "E", "F", "G", "H"]);
		const met = (a: string, b: string) =>
			[a, b].includes("t1") &&
			[a, b].some((t) => ["t6", "t7", "t8"].includes(t));
		for (const seed of SEEDS.slice(0, 16)) {
			const { pairs, relaxed } = run(quarters, teams, seed, met);
			expect(relaxed).toEqual(["rematch"]);
			const opponent = pairs
				.find((pair) => pair.includes("t1"))
				?.find((team) => team !== "t1");
			expect(tierOf(quarters, opponent as string)).toBe(3);
		}
	});

	it("SO7: constraints are relaxed in their order and only what the result breaks is listed", () => {
		// Region cannot hold (four teams of A), rematch can.
		const rules: BracketDrawRules = {
			tiers: [[1, 2, 3, 4]],
			meet: [],
			avoid: ["region", "rematch"],
		};
		const teams = field(["A", "A", "A", "B"]);
		const met = (a: string, b: string) =>
			[a, b].includes("t4") && [a, b].includes("t1");
		for (const seed of SEEDS.slice(0, 16)) {
			const { pairs, relaxed } = run(rules, teams, seed, met);
			expect(relaxed).toEqual(["region"]);
			expect(
				pairs.some((pair) => pair.includes("t4") && pair.includes("t1")),
			).toBe(false);
		}
	});

	it("SO9: the better tier, then the better entry place, takes the better seed of its pair", () => {
		const teams = field(["A", "B", "C", "D", "E", "F", "G", "H"]);
		for (const seed of SEEDS) {
			const { order, pairs, tiers } = run(quarters, teams, seed);
			expect(tiers.map(({ team }) => team)).toEqual(order);
			for (const [a, b] of pairs) {
				const key = (team: string) =>
					tierOf(quarters, team) * 64 + Number(team.slice(1));
				expect(key(a)).toBeLessThan(key(b));
				expect(order.indexOf(a)).toBeLessThan(order.indexOf(b));
			}
			// Game 1 priority follows the seed, so the better tier has it.
			const bracket = buildSingleElim({
				type: "singleElim",
				size: 8,
				bestOf: [3, 3, 5],
			});
			for (const match of resolveBracket(bracket, order, {}).matches) {
				if (match.round !== 1 || match.priority === null) continue;
				const pair = pairs.find((p) => p.includes(match.priority?.team ?? ""));
				expect(pair?.[0]).toBe(match.priority.team);
			}
		}
	});

	it("SO16: Worlds play-in has one tier of 4 and pairs freely", () => {
		const rules: BracketDrawRules = {
			tiers: [[1, 2, 3, 4]],
			meet: [],
			avoid: [],
		};
		const opponents = new Set(
			SEEDS.map((seed) =>
				run(rules, field(["A", "B", "C", "D"]), seed)
					.pairs.find((pair) => pair.includes("t1"))
					?.find((team) => team !== "t1"),
			),
		);
		expect(opponents).toEqual(new Set(["t2", "t3", "t4"]));
	});

	it("SO8: any earlier result has a draw, with each team once in single and double elimination", () => {
		const size = fc.constantFrom(4, 8, 16);
		fc.assert(
			fc.property(
				size.chain((n) =>
					fc.record({
						n: fc.constant(n),
						cuts: fc.uniqueArray(fc.integer({ min: 1, max: n - 1 }), {
							maxLength: 3,
						}),
						regions: fc.array(fc.constantFrom("A", "B", "C"), {
							minLength: n,
							maxLength: n,
						}),
						met: fc.array(fc.boolean(), { minLength: n * n, maxLength: n * n }),
						meetFirst: fc.boolean(),
						avoid: fc.shuffledSubarray([
							"regionHalf",
							"region",
							"rematch",
						] as const),
						seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
					}),
				),
				({ n, cuts, regions, met, meetFirst, avoid, seed }) => {
					const bounds = [0, ...[...cuts].sort((a, b) => a - b), n];
					const tiers = bounds
						.slice(1)
						.map((end, i) =>
							Array.from(
								{ length: end - (bounds[i] as number) },
								(_, k) => (bounds[i] as number) + k + 1,
							),
						);
					const first = tiers[0] as number[];
					const last = tiers[tiers.length - 1] as number[];
					const meet: [number, number][] =
						meetFirst && tiers.length > 1 && first.length <= last.length
							? [[1, tiers.length]]
							: [];
					const rules: BracketDrawRules = { tiers, meet, avoid };
					const teams = field(regions);
					const index = (t: string) => Number(t.slice(1)) - 1;
					const played = (a: string, b: string) =>
						met[index(a) * n + index(b)] === true ||
						met[index(b) * n + index(a)] === true;
					const result = run(rules, teams, seed, played);
					expect([...result.order].sort()).toEqual(
						teams.map((t) => t.team).sort(),
					);
					expect(result.pairs.flat().sort()).toEqual(
						teams.map((t) => t.team).sort(),
					);
					for (const [x, y] of meet) {
						for (const team of rules.tiers[x - 1] as number[]) {
							const pair = result.pairs.find((p) => p.includes(`t${team}`));
							const other = pair?.find((t) => t !== `t${team}`) as string;
							expect(tierOf(rules, other)).toBe(y);
						}
					}
					const single = buildSingleElim({
						type: "singleElim",
						size: n,
						bestOf: Array.from(
							{ length: { 4: 2, 8: 3, 16: 4 }[n] as number },
							() => 1 as const,
						),
					});
					const double = buildDoubleElim({
						type: "doubleElim",
						size: 4,
						upper: [1, 1],
						lower: [1, 1],
						drop: [[0, 0], [1]],
						lowerSeeds: [],
						grandFinal: 1,
						reset: false,
					});
					for (const bracket of n === 4 ? [single, double] : [single]) {
						const firstRound = resolveBracket(bracket, result.order, {})
							.matches.filter((m) => m.side === "upper" && m.round === 1)
							.flatMap((m) => [m.teamA, m.teamB]);
						expect(new Set(firstRound).size).toBe(n);
						expect(
							resolveBracket(bracket, result.order, {})
								.matches.filter((m) => m.side === "upper" && m.round === 1)
								.map((m) => [m.teamA, m.teamB]),
						).toEqual(expect.arrayContaining(result.pairs));
					}
				},
			),
			{ numRuns: 200 },
		);
	});
});
