import type { Personality } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { abs, SCALE } from "../math";
import { splitOf } from "./bank";
import { evaluate } from "./metric";
import { COMPONENT_KEYS, replay, type Turn } from "./replay";
import { calibrate, resolver, type Setup } from "./search";
import { syntheticDrafts } from "./synthetic";

const teams = [...new Set(fictionalContent.players.map((p) => p.team))].slice(
	0,
	8,
);
const personalityOf = (): Personality => "balanced";

// Hidden pro style: comfort over everything, meta barely matters.
const hidden = () => ({ comfort: 5 * SCALE, meta: 3_000 });
const drafts = syntheticDrafts(fictionalContent, teams, hidden, personalityOf);
const split = (which: "train" | "validation") =>
	drafts
		.filter((d) => splitOf(d, 7) === which)
		.flatMap((d) => replay(d, fictionalContent, personalityOf).turns);
const train: Turn[] = split("train");
const validation: Turn[] = split("validation");

const start: Setup = { base: {}, own: {} };

describe("resolver", () => {
	it("multiplies the base by what a personality changes", () => {
		const resolve = resolver({
			base: { meta: 20_000, comfort: 5_000 },
			own: { comfort: { comfort: 30_000, matchup: 20_000 } },
		});
		expect(resolve("balanced")).toEqual({ meta: 20_000, comfort: 5_000 });
		expect(resolve("comfort")).toEqual({
			meta: 20_000,
			comfort: 15_000,
			matchup: 20_000,
		});
	});
});

// The search is a real optimisation, so these tests are slow on a loaded machine.
describe("calibrate", { timeout: 120_000 }, () => {
	const result = calibrate({ train, validation, start, seed: 11 });

	it("has data on both sides of the split", () => {
		expect(train.length).toBeGreaterThan(300);
		expect(validation.length).toBeGreaterThan(100);
	});

	it("improves top 3 on the validation drafts it never saw", () => {
		const before = evaluate(validation, () => ({})).overall.top3;
		const after = evaluate(validation, (p) => ({
			...result.setup.base,
			...result.setup.own[p],
		})).overall.top3;
		expect(after).toBeGreaterThan(before);
		expect(result.accepted).toBe(true);
		expect(result.validation.after.overall.top3).toBe(after);
		expect(result.validation.before.overall.top3).toBe(before);
	});

	it("scales the base so the average component weighs x1, keeping the AI's temperature meaning", () => {
		const weights = COMPONENT_KEYS.map((k) => result.setup.base[k] ?? SCALE);
		const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
		expect(abs(mean - SCALE)).toBeLessThan(COMPONENT_KEYS.length);
	});

	it("is deterministic for a seed", () => {
		expect(calibrate({ train, validation, start, seed: 11 })).toEqual(result);
	});

	it("keeps the starting weights when validation does not improve", () => {
		const matched = syntheticDrafts(
			fictionalContent,
			teams,
			() => ({}),
			personalityOf,
		);
		const turns = matched.flatMap(
			(d) => replay(d, fictionalContent, personalityOf).turns,
		);
		const kept = calibrate({ train: turns, validation: turns, start, seed: 3 });
		expect(kept.accepted).toBe(false);
		expect(kept.setup).toEqual(start);
	});
});
