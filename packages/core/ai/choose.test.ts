import { describe, expect, it } from "vitest";
import type { Fixed } from "../math";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng as rawRng } from "../rng/streams";
import { choose, type DIFFICULTY, difficultyOf, type Scored } from "./choose";
import { PROFILES } from "./profiles";

const { balanced } = PROFILES;

// Seeds go through deriveSeed, as in production: consecutive raw seeds give
// correlated first draws.
const createRng = (seed: number) => rawRng(deriveSeed(seed, SCOPES.ai, 0));

const pts = (n: number) => n * 10_000;
const ladder = (...totals: number[]): Scored[] =>
	totals.map((total, i) => ({
		champion: `c${i}`,
		components: [{ key: "meta", points: pts(total) }],
	}));

const runs = (difficulty: keyof typeof DIFFICULTY, scored: Scored[], n = 500) =>
	Array.from(
		{ length: n },
		(_, seed) => choose(createRng(seed), scored, balanced, difficulty).champion,
	);

describe("difficulty (C4)", () => {
	it.each([
		[{ personality: "meta", coachRating: 0 }, "easy"],
		[{ personality: "meta", coachRating: 24 }, "easy"],
		[{ personality: "meta", coachRating: 25 }, "normal"],
		[{ personality: "meta", coachRating: 39 }, "normal"],
		[{ personality: "meta", coachRating: 40 }, "hard"],
		[{ personality: "meta", coachRating: 10, difficulty: "hard" }, "easy"],
		[{ personality: "meta", difficulty: "hard" }, "hard"],
		[{ personality: "meta" }, "normal"],
	] as const)("%o → %s", (settings, expected) => {
		expect(difficultyOf(settings)).toBe(expected);
	});
});

describe("choice (C2, C3)", () => {
	const scored = ladder(10, 9, 8.5, 8, 7, 6, 5, 4);

	it("is the same for the same seed", () => {
		const a = choose(createRng(9), scored, balanced, "normal");
		expect(choose(createRng(9), scored, balanced, "normal")).toEqual(a);
	});

	it("on hard stays within the two best and nearly always takes the first", () => {
		const picks = runs("hard", scored);
		expect(new Set(picks).size).toBeLessThanOrEqual(2);
		expect(picks.filter((c) => c === "c0").length).toBeGreaterThan(300);
	});

	it("on easy varies more than on hard", () => {
		expect(new Set(runs("easy", scored)).size).toBeGreaterThan(
			new Set(runs("hard", scored)).size,
		);
	});

	it("only leaves the pool through the wildcard", () => {
		const picks = runs("normal", scored, 2000);
		const outside = picks.filter((c) => !["c0", "c1", "c2"].includes(c));
		expect(outside.length).toBeGreaterThan(0);
		expect(outside.length).toBeLessThan(200);
		expect(outside.every((c) => ["c3", "c4", "c5", "c6"].includes(c))).toBe(
			true,
		);
	});

	it("takes a lone candidate", () => {
		expect(choose(createRng(1), ladder(3), balanced, "easy")).toMatchObject({
			champion: "c0",
			alternatives: [],
		});
	});
});

describe("profile adjustments to difficulty", () => {
	it("applies temperature before computing the runner-up's chance", () => {
		// Gap of one normal temperature. At half temperature the runner-up's weight is 135.
		const decision = choose(
			createRng(3),
			ladder(6, 4),
			{ ...balanced, temperature: 5_000 },
			"normal",
		);
		expect(decision.alternatives).toEqual([
			{ champion: "c1", total: pts(4), chance: 1_189 },
		]);
	});

	it("adds the profile's extra places to the pool", () => {
		const decision = choose(
			createRng(3),
			ladder(1, 1, 1),
			{ ...balanced, pool: 1 },
			"hard",
		);
		expect(decision.alternatives.map((c) => c.chance)).toEqual([3_333, 3_333]);
	});

	it("keeps at least the leader when the pool adjustment is negative", () => {
		const decision = choose(
			createRng(3),
			ladder(1, 1),
			{ ...balanced, pool: -5 },
			"hard",
		);
		expect(decision.champion).toBe("c0");
		expect(decision.alternatives[0]?.chance).toBe(0);
	});

	it("uses the adjusted wildcard threshold and first rank outside the adjusted pool", () => {
		const candidates = ladder(6, 5, 4);
		const profile = { ...balanced, pool: -1, wildcard: 20_000 };
		for (let seed = 0; seed < 100; seed++) {
			const roll = int(createRng(seed), 0, 9_999);
			const decision = choose(createRng(seed), candidates, profile, "normal");
			expect(decision.champion === "c2").toBe(roll < 1_000);
		}
	});
});

describe("explanation (E1, E2)", () => {
	const scored: Scored[] = [
		{
			champion: "a",
			components: [
				{ key: "meta", points: pts(5) },
				{ key: "comfort", points: pts(2) },
				{ key: "synergy", points: 0 },
			],
		},
		{ champion: "b", components: [{ key: "comfort", points: pts(4) }] },
		{ champion: "c", components: [{ key: "meta", points: pts(1) }] },
		{ champion: "d", components: [{ key: "meta", points: pts(-1) }] },
		{ champion: "e", components: [] },
	];

	it("weights each component by personality and drops zeros", () => {
		const weights = { meta: 16_000 as Fixed };
		const decision = choose(
			createRng(3),
			scored,
			{ ...balanced, weights },
			"hard",
		);
		expect(decision.champion).toBe("a");
		expect(decision.components).toEqual([
			{ key: "meta", points: pts(8) },
			{ key: "comfort", points: pts(2) },
		]);
		expect(decision.total).toBe(pts(10));
	});

	it("lists three alternatives with their chance", () => {
		const decision = choose(createRng(3), scored, balanced, "hard");
		expect(decision.alternatives.map((a) => a.champion)).toEqual([
			"b",
			"c",
			"e",
		]);
		expect(decision.alternatives[0]?.chance).toBeGreaterThan(0);
		expect(decision.alternatives[2]?.chance).toBe(0);
		const total = decision.alternatives.reduce((sum, a) => sum + a.chance, 0);
		expect(total).toBeLessThan(10_000);
	});
});
