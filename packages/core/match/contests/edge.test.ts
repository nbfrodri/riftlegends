import { expect, it } from "vitest";
import { matchSetup } from "../fixtures/setup";
import { createMatch, type MatchState } from "../state";
import { edge } from "./edge";

const goldPoints = (state: MatchState) =>
	edge(state, "fight").causes.find((c) => c.key === "gold")?.points ?? 0;

const withGold = (minute: number, blue: number, red: number): MatchState => {
	const state = createMatch(matchSetup());
	const paid = (gold: number) => [gold, gold, gold, gold, gold];
	return {
		...state,
		minute,
		blue: { ...state.blue, paid: paid(blue) },
		red: { ...state.red, paid: paid(red) },
	};
};

it("has no gold cause with equal gold", () => {
	expect(goldPoints(withGold(10, 1000, 1000))).toBe(0);
});

it("favours the side with more gold, and mirrors for the other", () => {
	const lead = goldPoints(withGold(10, 3000, 1000));
	expect(lead).toBeGreaterThan(0);
	expect(goldPoints(withGold(10, 1000, 3000))).toBe(-lead);
});

it("weighs the same gap less when both teams are complete", () => {
	const early = goldPoints(withGold(10, 3000, 1000));
	const late = goldPoints(withGold(35, 20_000, 18_000));
	expect(late).toBeLessThan(early);
});
