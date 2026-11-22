import { expect, test } from "vitest";
import { PLAYER_ATTRIBUTES } from "../../packages/contracts/draft/player-attributes.ts";
import {
	bandFloor,
	bandSpan,
	bandValue,
	playerLevel,
	shrunkPercentile,
} from "./attributes.ts";
import { eloOf, leagueOffset, leagueRating } from "./league-strength.ts";

test("the band maps percentiles to 55-88 with a centre of 71.5", () => {
	expect(bandValue(0)).toBe(bandFloor);
	expect(bandValue(1)).toBe(bandFloor + bandSpan);
	expect(bandValue(0.5)).toBe(71.5);
});

test("percentiles shrink to 0.5 with few games and rank ties at the middle", () => {
	const cohort = [1, 2, 3, 4].map((value) => ({ samples: 100, value }));
	expect(shrunkPercentile({ samples: 0, value: 4 }, cohort)).toBe(0.5);
	const few = shrunkPercentile({ samples: 6, value: 4 }, cohort);
	const many = shrunkPercentile({ samples: 100, value: 4 }, cohort);
	expect(few).toBeGreaterThan(0.5);
	expect(many).toBeGreaterThan(few);
	expect(
		shrunkPercentile({ samples: 100, value: 2 }, [
			{ samples: 100, value: 2 },
			{ samples: 100, value: 2 },
		]),
	).toBe(0.5);
});

test("level stretches the role focus, so a role specialist rates higher than its mirror", () => {
	const flat = Object.fromEntries(
		PLAYER_ATTRIBUTES.map((key) => [key, 70]),
	) as Record<(typeof PLAYER_ATTRIBUTES)[number], number>;
	expect(playerLevel(flat, "bot")).toBe(70);
	expect(
		playerLevel({ ...flat, farming: 90, mechanics: 90 }, "bot"),
	).toBeGreaterThan(playerLevel({ ...flat, vision: 90, roaming: 90 }, "bot"));
});

test("league priors rank LCK above CBLOL and a dominant weak-league team does not pass the top of LCK", () => {
	expect(leagueOffset.LCK).toBeGreaterThan(leagueOffset.LPL ?? 0);
	expect(leagueOffset.LCS).toBeGreaterThan(leagueOffset.CBLOL ?? 0);
	expect(eloOf(0.5)).toBe(0);
	const dominant = (leagueRating.LCP ?? 0) + eloOf(0.8);
	const lckTop = (leagueRating.LCK ?? 0) + eloOf(0.75);
	expect(lckTop).toBeGreaterThan(dominant);
});
