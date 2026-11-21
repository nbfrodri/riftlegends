import type { Side } from "@rift-legends/contracts";
import { type Fixed, mul } from "../../math";
import type { CONTESTS, Scored } from "../profile";
import type { MatchState } from "../state";
import { chance } from "./chance";

type Contest = (typeof CONTESTS)[number];

/** Points of edge per gold of difference, before the weight of the minute. */
const GOLD_POINTS = 40;
const MID_GAME = 14;
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
	for (const part of parts) {
		for (const { key, points } of part.causes) {
			byKey.set(key, (byKey.get(key) ?? 0) + points);
		}
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
export function edge(state: MatchState, contest: Contest): Edge {
	const blue = strength(state, "blue", contest);
	const red = strength(state, "red", contest);
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
	return { blue: chance(total), causes };
}

/** The winner's chance and causes, seen from the winner. */
export function outcome(result: Edge, winner: Side) {
	const flip = winner === "blue" ? 1 : -1;
	return {
		chance: winner === "blue" ? result.blue : 10000 - result.blue,
		causes: result.causes.map((c) => ({ key: c.key, points: c.points * flip })),
	};
}
