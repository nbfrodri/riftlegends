import type { Side } from "@rift-legends/contracts";
import { type Fixed, mul } from "../../math";
import type { CONTESTS, Scored } from "../profile";
import { type MatchState, SOUL } from "../state";
import { chance } from "./chance";

type Contest = (typeof CONTESTS)[number];

/** Points of edge per gold of difference, before the weight of the minute. */
const GOLD_POINTS = 40;
/** Points of each buff in the contests it helps. Balance constants. */
const DRAGON_POINTS = 20_000;
const SOUL_POINTS = 60_000;
const BUFF_POINTS: Record<
	"herald" | "baron" | "elder",
	Partial<Record<Contest, number>>
> = {
	herald: { siege: 80_000 },
	baron: { siege: 150_000, fight: 80_000, objective: 50_000 },
	elder: { fight: 200_000, siege: 200_000, objective: 100_000 },
};
/** Calibrates the probability curve to game outcomes (K4). */
const EDGE_SCALE = 1600 as Fixed;
const RISK_SCALE = { safe: 18_000, balanced: 10_000, risky: 2000 } as const;
const AGGRESSION_SCALE = 28;
const FIGHT_PUSH_POINTS = 500_000;
export const MID_GAME = 14;
const LATE_GAME = 26;

const phaseOf = (minute: number) =>
	minute < MID_GAME ? "early" : minute < LATE_GAME ? "mid" : "late";

function goldWeight(state: MatchState): number {
	let weight = 0;
	for (const step of state.context.rules.goldWeight) {
		if (step.minute <= state.minute) weight = step.weight;
	}
	return weight;
}

function strength(state: MatchState, side: Side, contest: Contest) {
	const { profile } = state.context[side];
	const parts: Scored[] = [
		profile.contests[contest],
		profile.phases[phaseOf(state.minute)],
	];
	const byKey = new Map<string, number>();
	const add = (key: string, points: number) =>
		byKey.set(key, (byKey.get(key) ?? 0) + points);
	for (const part of parts) {
		for (const { key, points } of part.causes) add(key, points);
	}
	const { form, mental } = state.context[side];
	add("form", form);
	for (const scored of [mental?.general, mental?.byContest[contest]]) {
		for (const { key, points } of scored?.causes ?? []) add(key, points);
	}
	const own = state[side];
	if (
		contest === "siege" &&
		state.minute > 0 &&
		own.fightPushAt === state.minute
	)
		add("fight", FIGHT_PUSH_POINTS);
	add("dragons", own.dragons * DRAGON_POINTS);
	if (own.dragons >= SOUL) add("soul", SOUL_POINTS);
	for (const buff of ["herald", "baron", "elder"] as const) {
		if (own.buffs[buff] > state.minute)
			add(buff, BUFF_POINTS[buff][contest] ?? 0);
	}
	return byKey;
}

export interface Edge {
	/** Chance, per 10,000, that blue wins. */
	readonly blue: number;
	/** Why, as blue's edge over red; negative points favour red. */
	readonly causes: readonly { key: string; points: number }[];
}

/** Edge of blue over red in a contest, from the profiles and the state. */
export function edge(
	state: MatchState,
	contest: Contest,
	/** Points a contest adds on top, by side. */
	extra: Partial<
		Record<Side, { key: string; points: number } | undefined>
	> = {},
): Edge {
	const blue = strength(state, "blue", contest);
	const red = strength(state, "red", contest);
	for (const [side, map] of [
		["blue", blue],
		["red", red],
	] as const) {
		const bonus = extra[side];
		if (bonus) map.set(bonus.key, (map.get(bonus.key) ?? 0) + bonus.points);
	}
	const causes: { key: string; points: number }[] = [];
	for (const key of new Set([...blue.keys(), ...red.keys()])) {
		const points = (blue.get(key) ?? 0) - (red.get(key) ?? 0);
		if (points !== 0) causes.push({ key, points });
	}
	const gold = mul(
		((state.blue.gold - state.red.gold) * GOLD_POINTS) as Fixed,
		goldWeight(state) as Fixed,
	);
	if (gold !== 0) causes.push({ key: "gold", points: gold });
	const total = causes.reduce((sum, c) => sum + c.points, 0);
	// Both teams affect how decisive the contest is, independently of who leads.
	const risk = (side: Side) => {
		const { aggression, strategy } = state.context[side];
		return RISK_SCALE[strategy.risk] + (50 - aggression) * AGGRESSION_SCALE;
	};
	const scale = (risk("blue") + risk("red")) / 2;
	const adjusted = mul(total as Fixed, scale as Fixed);
	const adjustment = adjusted - total;
	if (adjustment !== 0) causes.push({ key: "risk", points: adjustment });
	return { blue: chance(mul(adjusted, EDGE_SCALE)), causes };
}

/** The winner's chance and causes, seen from the winner. */
export function outcome(result: Edge, winner: Side) {
	const flip = winner === "blue" ? 1 : -1;
	return {
		chance: winner === "blue" ? result.blue : 10000 - result.blue,
		causes: result.causes.map((c) => ({ key: c.key, points: c.points * flip })),
	};
}
