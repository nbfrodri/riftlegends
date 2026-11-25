import type { Personality } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { SCALE } from "../math";
import { evaluate, rankOf } from "./metric";
import type { Turn } from "./replay";
import { COMPONENT_KEYS } from "./replay";

const K = COMPONENT_KEYS.length;
const keyAt = (key: string) => COMPONENT_KEYS.indexOf(key as never);

/** Candidates a..e with a `meta` and `comfort` score each, in order. */
const turn = (
	actual: number,
	scores: readonly (readonly [number, number])[],
	over: Partial<Turn> = {},
): Turn => {
	const points = new Int32Array(scores.length * K);
	scores.forEach(([meta, comfort], i) => {
		points[i * K + keyAt("meta")] = meta;
		points[i * K + keyAt("comfort")] = comfort;
	});
	return {
		league: "LCK",
		phase: "picks1",
		action: "pick",
		personality: "balanced",
		candidates: scores.map((_, i) => String.fromCharCode(97 + i)),
		points,
		actual,
		...over,
	};
};

const neutral = () => ({}) as Record<string, number>;
const ones = (_: Personality) => neutral();

describe("rankOf", () => {
	const scores = [
		[10_000, 0],
		[0, 30_000],
		[5_000, 5_000],
	] as const;

	it("ranks by the weighted total", () => {
		expect(rankOf(turn(0, scores), ones)).toBe(2);
		expect(rankOf(turn(1, scores), ones)).toBe(1);
		const comfortHeavy = () => ({ comfort: 3 * SCALE });
		expect(rankOf(turn(0, scores), comfortHeavy)).toBe(3);
	});

	it("breaks ties by champion id, like the AI", () => {
		const tie = [
			[10_000, 0],
			[10_000, 0],
		] as const;
		expect(rankOf(turn(0, tie), ones)).toBe(1);
		expect(rankOf(turn(1, tie), ones)).toBe(2);
	});

	it("uses the weights of the turn's personality", () => {
		const resolve = (p: Personality) =>
			p === "comfort" ? { comfort: 4 * SCALE } : {};
		expect(rankOf(turn(0, scores, { personality: "comfort" }), resolve)).toBe(
			3,
		);
		expect(rankOf(turn(0, scores), resolve)).toBe(2);
	});
});

describe("evaluate", () => {
	const scores = [
		[40_000, 0],
		[30_000, 0],
		[20_000, 0],
		[10_000, 0],
	] as const;
	const turns = [
		turn(0, scores),
		turn(2, scores, { phase: "bans1", action: "ban", league: "LEC" }),
		turn(3, scores, { phase: "bans1", action: "ban", league: "LEC" }),
	];

	it("counts top 1 and top 3 overall, per phase, league and personality", () => {
		const report = evaluate(turns, ones);
		expect(report.overall).toEqual({ turns: 3, top1: 1, top3: 2 });
		expect(report.phases.picks1).toEqual({ turns: 1, top1: 1, top3: 1 });
		expect(report.phases.bans1).toEqual({ turns: 2, top1: 0, top3: 1 });
		expect(report.phases.picks2).toEqual({ turns: 0, top1: 0, top3: 0 });
		expect(report.leagues.LEC).toEqual({ turns: 2, top1: 0, top3: 1 });
		expect(report.personalities.balanced?.turns).toBe(3);
	});

	it("is deterministic", () => {
		expect(evaluate(turns, ones)).toEqual(evaluate(turns, ones));
	});
});
