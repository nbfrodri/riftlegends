import { expect, it } from "vitest";
import type { AiContext } from "../context";
import { points, scenario } from "../fixtures/scenario";
import { scoreBan } from "./ban";
import { scorePick } from "./pick";

const pick = (key: string, id: string, overrides: Partial<AiContext>) =>
	points(scorePick(scenario(overrides), id), key);

it.each(["soft", "hard"] as const)(
	"B3 reserves S and S+ in %s fearless until either team reaches match point",
	(fearless) => {
		const reserve = (id: string, game: number, wins: AiContext["wins"]) =>
			pick("fearlessReserve", id, { fearless, game, wins });
		expect(reserve("suncord", 1, [0, 0])).toBeLessThan(
			reserve("suncord", 3, [1, 1]),
		);
		expect(reserve("cragbell", 3, [1, 1])).toBeLessThan(0);
		expect(reserve("copperfin", 1, [0, 0])).toBe(0);
		expect(reserve("cragbell", 3, [2, 0])).toBe(0);
		expect(reserve("cragbell", 3, [0, 2])).toBe(0);
		expect(pick("fearlessReserve", "cragbell", { fearless: "off" })).toBe(0);
		expect(
			pick("fearlessReserve", "cragbell", { fearless, winsNeeded: 1 }),
		).toBe(0);
		expect(
			points(
				scoreBan(scenario({ step: 0, fearless }), "suncord"),
				"fearlessReserve",
			),
		).toBe(0);
	},
);

it("B4 rewards blue roster-backed flex only during the first pick phase", () => {
	const side = (id: string, overrides: Partial<AiContext>) =>
		pick("side", id, overrides);
	expect(side("rimefoil", { step: 9 })).toBeGreaterThan(0);
	expect(side("rimefoil", { team: "shoal", rival: "forge", step: 9 })).toBe(0);
	expect(side("rimefoil", { step: 17 })).toBe(0);
	expect(side("rimefoil", { order: "last", step: 7 })).toBe(0);
	expect(side("cragbell", { step: 6 })).toBe(0);
});

it("B4 rewards red's final counter only when it can meet that opponent in lane", () => {
	const side = (step: number, shoal: string[]) =>
		pick("side", "glasswake", { order: "last", step, picks: { shoal } });
	expect(side(19, ["rimefoil"])).toBeGreaterThan(0);
	expect(side(16, ["rimefoil"])).toBe(0);
	expect(side(19, ["rimefoil", "prismoth"])).toBe(0);
	expect(side(19, ["waxblade"])).toBe(0);
});

it("emits a unique key and a nonzero fixed-point integer for each pick and ban contribution", () => {
	const ctx = scenario({
		fearless: "soft",
		picks: { forge: ["prismoth"], shoal: ["suncord"] },
	});
	for (const candidate of ctx.content.champions) {
		for (const components of [
			scorePick(ctx, candidate.id),
			scoreBan({ ...ctx, step: 13 }, candidate.id),
		]) {
			expect(new Set(components.map((c) => c.key)).size).toBe(
				components.length,
			);
			for (const c of components) {
				expect(Number.isSafeInteger(c.points)).toBe(true);
				expect(c.points).not.toBe(0);
			}
		}
	}
});
