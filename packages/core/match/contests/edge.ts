import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import { type Fixed, mul } from "../../math";
import type { MatchCause, MatchCauseKey } from "../cause-keys";
import { spreeBounty } from "../events";
import { gameSecond } from "../player-state";
import {
	downOf,
	numbersPoints,
	presenceOf,
	upAt,
	type Weights,
	weightsOf,
} from "../presence";
import { type CONTESTS, liveCauses, staticCauses } from "../profile";
import { LANES, type Lane, type MatchState, SOUL } from "../state";
import { type Ultimates, ultimatesIn } from "../ultimates";
import { chance } from "./chance";
import { goldLead } from "./gold";

type Contest = (typeof CONTESTS)[number];

/** Points of each buff in the contests it helps. Balance constants. */
const DRAGON_POINTS = 20_000;
/**
 * Points per rival nexus tower or inhibitor down: once a base is open the
 * side that opened it decides the game, so equal tower trades end with the
 * leader ahead in gold too (K16).
 */
const STRUCTURE_POINTS = 1_300_000;
/** Share of those points a fight counts for the side that opened the base (#530). */
const FIGHT_STRUCTURE_PERCENT = 160;
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
const EDGE_SCALE = 1550 as Fixed;
const RISK_SCALE = { safe: 18_000, balanced: 10_000, risky: 2000 } as const;
const AGGRESSION_SCALE = 28;
const SPREE_POINTS = 500;
const XP_POINTS = 20;
export const MID_GAME = 14;
const LATE_GAME = 26;

const phaseOf = (minute: number) =>
	minute < MID_GAME ? "early" : minute < LATE_GAME ? "mid" : "late";

function strength(
	state: MatchState,
	side: Side,
	contest: Contest,
	weights: Weights,
	up: readonly Role[],
	lane?: Lane,
) {
	const { profile } = state.context[side];
	const phase = phaseOf(state.minute);
	const byKey = new Map<MatchCauseKey, number>();
	const add = (key: MatchCauseKey, points: number) =>
		byKey.set(key, (byKey.get(key) ?? 0) + points);
	// The draft's factors stay as they are; the players' attributes count only
	// the ones that are up (plan 08, #529).
	for (const part of [profile.contests[contest], profile.phases[phase]]) {
		for (const { key, points } of staticCauses(part)) add(key, points);
	}
	for (const part of [contest, phase] as const) {
		for (const { key, points } of liveCauses(profile, part, weights, up)) {
			add(key, points);
		}
	}
	const { form, mental } = state.context[side];
	add("form", form);
	for (const scored of [mental?.general, mental?.byContest[contest]]) {
		for (const { key, points } of scored?.causes ?? []) add(key, points);
	}
	const players = state.context[side].players;
	const involved =
		contest === "lane" && lane
			? lane === "bot"
				? (["bot", "support"] as const)
				: [lane]
			: contest === "jungle"
				? (["jungle"] as const)
				: ROLES;
	for (const role of involved) {
		const streak = state.plays.streaks.get(players[role]) ?? 0;
		const bounty = spreeBounty(streak);
		if (bounty > 0) {
			add("killingSpree", SPREE_POINTS * (streak < 8 ? streak - 2 : 6));
			add("shutdownRisk", -bounty);
		}
	}
	const own = state[side];
	const rival = state[side === "blue" ? "red" : "blue"];
	const base =
		rival.nexusTowers +
		LANES.filter((lane) => rival.inhibitors[lane] > state.minute).length;
	if (contest === "siege") add("structures", base * STRUCTURE_POINTS);
	else if (contest === "fight") {
		// The side that has the rival's base open fights with the map behind it.
		add(
			"structures",
			(base * STRUCTURE_POINTS * FIGHT_STRUCTURE_PERCENT) / 100,
		);
	}
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
	readonly causes: readonly MatchCause[];
	/** Who counted for the contest and was down, when anyone was. */
	readonly down?: Record<Side, Role[]>;
	/** Ultimates spent and on cooldown among who took part (#339). */
	readonly spent?: Ultimates["spent"];
	readonly onCooldown?: Ultimates["onCooldown"];
}

/**
 * Edge of blue over red in a contest, from the profiles and the state, for
 * the players that are up at `at` (second of the game; the start of the
 * minute by default). A side with no presence in the contest, with nobody up
 * or without the laner of a lane, loses without a roll (plan 08, #529).
 */
export function edge(
	state: MatchState,
	contest: Contest,
	/** Points a contest adds on top, by side. */
	extra: Partial<Record<Side, MatchCause | undefined>> = {},
	lane?: Lane,
	at = gameSecond(state.minute > 0 ? state.minute : 1, 0),
): Edge {
	const weights = weightsOf(state.context.rules, contest, lane);
	const up = upAt(state, at);
	const present = {
		blue: presenceOf(weights, up.blue),
		red: presenceOf(weights, up.red),
	};
	const counted = ROLES.filter((role) => weights[role] > 0);
	const missing = {
		blue: downOf(up.blue).filter((role) => counted.includes(role)),
		red: downOf(up.red).filter((role) => counted.includes(role)),
	};
	const down =
		missing.blue.length + missing.red.length > 0 ? missing : undefined;
	if (present.blue === 0 || present.red === 0) {
		const none = present.blue === present.red;
		const points = numbersPoints(contest, present.blue, present.red);
		return {
			blue: none ? 5000 : present.blue === 0 ? 0 : 10_000,
			causes: none ? [] : [{ key: "numbers", points }],
			...(down ? { down } : {}),
		};
	}
	const blue = strength(state, "blue", contest, weights, up.blue, lane);
	const red = strength(state, "red", contest, weights, up.red, lane);
	for (const [side, map] of [
		["blue", blue],
		["red", red],
	] as const) {
		const bonus = extra[side];
		if (bonus) map.set(bonus.key, (map.get(bonus.key) ?? 0) + bonus.points);
	}
	const causes: MatchCause[] = [];
	for (const key of new Set([...blue.keys(), ...red.keys()])) {
		const points = (blue.get(key) ?? 0) - (red.get(key) ?? 0);
		if (points !== 0) causes.push({ key, points });
	}
	const gold = goldLead(state.blue.paid, state.red.paid, state.context.rules);
	const experience =
		contest === "lane" && lane ? state.plays.laneExperience[lane] : 0;
	if (experience !== 0)
		causes.push({ key: "soloExperience", points: experience * XP_POINTS });
	if (gold !== 0) causes.push({ key: "gold", points: gold });
	const numbers = numbersPoints(contest, present.blue, present.red);
	if (numbers !== 0) causes.push({ key: "numbers", points: numbers });
	// A state of the moment, like the players up: counted once, before the risk.
	const ultimates = ultimatesIn(state, contest, weights, up, at);
	if (ultimates.points !== 0) {
		causes.push({ key: "ultimates", points: ultimates.points });
	}
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
	return {
		blue: chance(mul(adjusted, EDGE_SCALE)),
		causes,
		...(down ? { down } : {}),
		...used(ultimates),
	};
}

/** The fields of an event about the resources of a contest, when it has any. */
export const used = ({
	spent,
	onCooldown,
}: {
	readonly spent?: Ultimates["spent"] | undefined;
	readonly onCooldown?: Ultimates["onCooldown"] | undefined;
}) => ({
	...(spent ? { spent } : {}),
	...(onCooldown ? { onCooldown } : {}),
});

/** The winner's chance and causes, seen from the winner. */
export function outcome(result: Edge, winner: Side) {
	const flip = winner === "blue" ? 1 : -1;
	return {
		chance: winner === "blue" ? result.blue : 10000 - result.blue,
		causes: result.causes.map((c) => ({ key: c.key, points: c.points * flip })),
		...(result.down ? { down: result.down } : {}),
		...used(result),
	};
}
