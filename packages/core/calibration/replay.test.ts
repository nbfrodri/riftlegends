import type { Personality } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { PROFILES } from "../ai/profiles";
import { mul, SCALE } from "../math";
import type { ProDraft } from "./bank";
import { fastMul } from "./metric";
import { COMPONENT_KEYS, replay } from "./replay";
import { syntheticDrafts } from "./synthetic";

const teams = fictionalContent.players
	.map((p) => p.team)
	.filter((t, i, all) => all.indexOf(t) === i)
	.slice(0, 3);
const personalityOf = (): Personality => "balanced";
const resolve = (p: Personality) => PROFILES[p].weights;
const [draft] = syntheticDrafts(
	fictionalContent,
	teams,
	resolve,
	personalityOf,
) as [ProDraft];

describe("replay", () => {
	it("makes one turn per step, in four phases of 6, 6, 4 and 4", () => {
		const { turns, skipped } = replay(draft, fictionalContent, personalityOf);
		expect(skipped).toBe(0);
		expect(turns.map((t) => t.phase)).toEqual([
			...Array(6).fill("bans1"),
			...Array(6).fill("picks1"),
			...Array(4).fill("bans2"),
			...Array(4).fill("picks2"),
		]);
		expect(turns.map((t) => t.action)).toEqual(
			turns.map((t) => (t.phase.startsWith("bans") ? "ban" : "pick")),
		);
	});

	it("points at the real champion among the free candidates", () => {
		const { turns } = replay(draft, fictionalContent, personalityOf);
		turns.forEach((turn, step) => {
			expect(turn.candidates[turn.actual]).toBe(draft.actions[step]);
		});
		// Nothing already banned or picked is offered again.
		const last = turns[19];
		expect(last?.candidates).not.toContain(draft.actions[0]);
		expect(last?.candidates).not.toContain(draft.actions[6]);
	});

	it("only emits known component keys", () => {
		const { turns } = replay(draft, fictionalContent, personalityOf);
		expect(turns.some((t) => t.points.some((p) => p !== 0))).toBe(true);
		expect(COMPONENT_KEYS).toContain("meta");
		expect(COMPONENT_KEYS).toContain("comfort");
	});

	it("skips an empty ban and a champion that was not free", () => {
		const actions = [...draft.actions];
		actions[0] = null;
		actions[1] = actions[7] as string; // picked later, but banned now: legal
		actions[7] = actions[1] as string; // the second use is not free
		const { turns, skipped } = replay(
			{ ...draft, actions },
			fictionalContent,
			personalityOf,
		);
		expect(skipped).toBe(2);
		expect(turns).toHaveLength(18);
	});

	it("is deterministic", () => {
		const a = replay(draft, fictionalContent, personalityOf);
		const b = replay(draft, fictionalContent, personalityOf);
		expect(b).toEqual(a);
	});
});

describe("fastMul", () => {
	it("matches the fixed-point multiplication, rounding half to even", () => {
		for (const a of [0, 1, -1, 5_000, -5_000, 12_345, -99_999, 250_000]) {
			for (const b of [0, 1, 5_000, 7_500, 10_000, 14_500, 35_000, 2]) {
				expect(fastMul(a, b)).toBe(mul(a as never, b as never));
			}
		}
		expect(fastMul(5, SCALE / 2)).toBe(2); // 2.5 -> 2
		expect(fastMul(7, SCALE / 2)).toBe(4); // 3.5 -> 4
	});
});
