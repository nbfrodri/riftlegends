import type { MatchContent } from "@rift-legends/contracts";
import { div, type Fixed, mul, SCALE } from "../../math";
import { clamp } from "../../math/int";

type GoldRules = Pick<
	MatchContent["rules"],
	"fullBuildGold" | "goldOverflow" | "goldLeadPoints" | "goldMaxPoints"
>;

/**
 * Gold that still helps a player: all of it up to the full build, and only the
 * overflow share of what is above (plan 08, G3).
 */
export function usefulGold(gold: number, rules: GoldRules): number {
	if (gold <= rules.fullBuildGold) return gold;
	const over = gold - rules.fullBuildGold;
	// `over * overflow` is exact in a double; round half to even like `mul`.
	const scaled = over * rules.goldOverflow;
	const whole = (scaled - (scaled % SCALE)) / SCALE;
	const rest = scaled % SCALE;
	const counted =
		rest * 2 > SCALE || (rest * 2 === SCALE && whole % 2 === 1)
			? whole + 1
			: whole;
	return rules.fullBuildGold + counted;
}

/**
 * Points of edge for blue from the gold of both teams (one entry per player).
 * The lead is relative to the useful gold of both sides, so it weighs more
 * early and little once the players are complete (plan 08, G2).
 */
export function goldLead(
	blue: readonly number[],
	red: readonly number[],
	rules: GoldRules,
): number {
	const useful = (team: readonly number[]) =>
		team.reduce((sum, gold) => sum + usefulGold(gold, rules), 0);
	const blueGold = useful(blue);
	const redGold = useful(red);
	const total = blueGold + redGold;
	if (total === 0) return 0;
	const lead = div((blueGold - redGold) as Fixed, total as Fixed);
	return clamp(
		mul(lead, rules.goldLeadPoints as Fixed),
		-rules.goldMaxPoints,
		rules.goldMaxPoints,
	);
}
