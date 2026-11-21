import { describe, expect, it } from "vitest";
import type { Fixed } from "../math";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng as rawRng } from "../rng/streams";
import { choose, type DIFFICULTY, difficultyOf, type Scored } from "./choose";

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
		(_, seed) => choose(createRng(seed), scored, {}, difficulty).champion,
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
		const a = choose(createRng(9), scored, {}, "normal");
		expect(choose(createRng(9), scored, {}, "normal")).toEqual(a);
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
		expect(choose(createRng(1), ladder(3), {}, "easy")).toMatchObject({
			champion: "c0",
			alternatives: [],
		});
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
		const decision = choose(createRng(3), scored, weights, "hard");
		expect(decision.champion).toBe("a");
		expect(decision.components).toEqual([
			{ key: "meta", points: pts(8) },
			{ key: "comfort", points: pts(2) },
		]);
		expect(decision.total).toBe(pts(10));
	});

	it("lists three alternatives with their chance", () => {
		const decision = choose(createRng(3), scored, {}, "hard");
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
