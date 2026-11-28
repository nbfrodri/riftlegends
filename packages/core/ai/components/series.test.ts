import { describe, expect, it } from "vitest";
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

it("B4 first pick secures top-tier or roster-backed flex champions in the first pick phase", () => {
	const first = (id: string, overrides: Partial<AiContext> = {}) =>
		pick("firstPick", id, overrides);
	expect(first("suncord")).toBeGreaterThan(first("cragbell"));
	expect(first("cragbell")).toBeGreaterThan(0);
	expect(first("copperfin")).toBe(0);
	expect(first("rimefoil", { step: 9 })).toBeGreaterThan(0);
	expect(first("rimefoil", { team: "shoal", rival: "forge", step: 9 })).toBe(0);
	expect(first("suncord", { step: 17 })).toBe(0);
	expect(first("suncord", { order: "last", step: 7 })).toBe(0);
	expect(pick("lastPick", "suncord", {})).toBe(0);
});

it("B4 rewards the last pick's final counter only when it can meet that opponent in lane", () => {
	const last = (step: number, shoal: string[]) =>
		pick("lastPick", "glasswake", { order: "last", step, picks: { shoal } });
	expect(last(19, ["rimefoil"])).toBeGreaterThan(0);
	expect(last(19, ["rimefoil", "prismoth"])).toBe(0);
	expect(last(19, ["waxblade"])).toBe(0);
	expect(pick("firstPick", "glasswake", { order: "last", step: 19 })).toBe(0);
});

describe("B4 the last pick keeps a lane whose opponent is still hidden", () => {
	// Forge has top and mid open. Shoal has shown its top, not its mid.
	const board = {
		forge: ["duskroot", "copperfin", "bronzehook"],
		shoal: ["saltspire", "coalstride", "suncord"],
	};
	const last = (id: string, overrides: Partial<AiContext> = {}) =>
		pick("lastPick", id, {
			order: "last",
			step: 16,
			picks: board,
			...overrides,
		});

	it("costs a pick that fills the hidden lane and leaves only a known one", () => {
		expect(last("glasswake")).toBeLessThan(0);
		expect(last("cragbell")).toBe(0);
	});

	it("costs nothing when no lane is hidden, at the final pick or for the first pick", () => {
		const shown = { ...board, shoal: [...board.shoal, "prismoth"] };
		expect(last("glasswake", { picks: shown })).toBe(0);
		expect(last("glasswake", { step: 19 })).toBe(0);
		expect(pick("lastPick", "glasswake", { step: 16, picks: board })).toBe(0);
	});

	it("does not count a hidden lane the team can no longer keep open", () => {
		// With only mid open, picking it is forced.
		const forced = { ...board, forge: [...board.forge, "cragbell"] };
		expect(last("glasswake", { picks: forced, step: 19 })).toBe(0);
		expect(last("glasswake", { picks: forced, step: 11 })).toBe(0);
	});
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
