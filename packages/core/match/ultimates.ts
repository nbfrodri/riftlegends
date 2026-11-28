import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import { min } from "../math";
import { levelAt, roundHalfEven } from "./death-timer";
import { isAlive } from "./player-state";
import { playerPoints, type Weights } from "./presence";
import type { Contest } from "./profile";
import type { MatchState } from "./state";

/**
 * The ultimate as a fight resource (plan 08, #339): ready once learned, on
 * cooldown after a contest it counted in, win or lose. The cooldown is a
 * second of the game in the player's state; nothing ticks.
 */

type Tenths = readonly [number, number, number];

/** Cooldown in tenths at ranks 1–3 when the game data has none: estimated. */
export const ESTIMATED_ULT: Tenths = [1200, 1000, 800];

/** What a player's ultimate is, fixed for the game. */
export interface UltKit {
	readonly tenths: Tenths;
	/** An `engage` champion or a `wombo` kit: it is worth more and goes first. */
	readonly key: boolean;
}

export function ultKit(
	champion:
		| {
				readonly archetypes: readonly string[];
				readonly kit?: readonly string[] | undefined;
				readonly ultCooldownTenths?: Tenths | undefined;
		  }
		| undefined,
): UltKit {
	return {
		tenths: champion?.ultCooldownTenths ?? ESTIMATED_ULT,
		key:
			(champion?.archetypes.includes("engage") ||
				champion?.kit?.includes("wombo")) ??
			false,
	};
}

/** Rank at a level: 0 before 6, then 1, 2 and 3 from 6, 11 and 16. */
export const ultRank = (level: number) =>
	level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;

/** Seconds of cooldown: `round(base × 100 / (100 + haste))`, half to even. */
export const ultCooldown = (tenths: Tenths, rank: 1 | 2 | 3, haste: number) =>
	roundHalfEven((tenths[rank - 1] as number) * 100, (100 + haste) * 10);

const rankAt = (state: MatchState, role: Role, second: number) =>
	ultRank(levelAt(state.context.rules.levelCurve, role, second));

/** Second of the game an ultimate used at `second` is back. */
function readyAfter(state: MatchState, side: Side, role: Role, second: number) {
	const { rules } = state.context;
	const haste = rules.ultHaste[
		min((second - (second % 60)) / 60, rules.ultHaste.length - 1)
	] as number;
	const rank = rankAt(state, role, second) as 1 | 2 | 3;
	return (
		second +
		ultCooldown(state.context[side].ultimates[role].tenths, rank, haste)
	);
}

export type UltStatus = "locked" | "ready" | "cooldown";

export function ultStatus(
	state: MatchState,
	side: Side,
	role: Role,
	second: number,
): UltStatus {
	if (rankAt(state, role, second) === 0) return "locked";
	return state[side].players[role].ultReadyAt <= second ? "ready" : "cooldown";
}

type Spent = { role: Role; resource: "ult"; readyAt: number };
type Cooling = { role: Role; resource: "ult" };

export interface Ultimates {
	/** Blue's points over red's, capped. */
	readonly points: number;
	readonly spent?: Record<Side, Spent[]>;
	readonly onCooldown?: Record<Side, Cooling[]>;
}

const TEAM_CONTESTS: ReadonlySet<Contest> = new Set(["fight", "objective"]);

/** A list per side, or nothing when both are empty. */
const listed = <T>(lists: Record<Side, T[]>) =>
	lists.blue.length + lists.red.length > 0 ? lists : undefined;

/**
 * The ultimates of a contest at `at`: those of the players up with weight in
 * it, the most valuable first up to the side's limit (key carriers and then
 * role order on a tie), each worth a share of one player of its role. With
 * the points at 0 nothing counts, so nothing is spent (C1).
 */
export function ultimatesIn(
	state: MatchState,
	contest: Contest,
	weights: Weights,
	up: Readonly<Record<Side, readonly Role[]>>,
	at: number,
): Ultimates {
	const rules = state.context.rules.cooldowns.ult;
	if (rules.points + rules.keyPoints === 0) return { points: 0 };
	const limit = TEAM_CONTESTS.has(contest) ? rules.team : rules.local;
	const share = (points: number, part: number) =>
		(points * part - ((points * part) % 10_000)) / 10_000;
	// Levels go by role, so a rank is the same on both sides.
	const ranks = ROLES.map((role) => rankAt(state, role, at));
	let top = 0;
	for (const role of ROLES) {
		const points = playerPoints(contest, weights[role]);
		if (points > top) top = points;
	}
	const side = (which: Side) => {
		const kits = state.context[which].ultimates;
		const players = state[which].players;
		const ready: { role: Role; worth: number; key: boolean; order: number }[] =
			[];
		const onCooldown: Cooling[] = [];
		for (const role of up[which]) {
			const order = ROLES.indexOf(role);
			if (weights[role] === 0 || ranks[order] === 0) continue;
			if (players[role].ultReadyAt > at) {
				onCooldown.push({ role, resource: "ult" });
				continue;
			}
			const { key } = kits[role];
			const worth = share(
				playerPoints(contest, weights[role]),
				key ? rules.keyPoints : rules.points,
			);
			if (worth > 0) ready.push({ role, worth, key, order });
		}
		ready.sort(
			(a, b) =>
				b.worth - a.worth || Number(b.key) - Number(a.key) || a.order - b.order,
		);
		const counted = ready.slice(0, limit);
		return {
			points: counted.reduce((sum, { worth }) => sum + worth, 0),
			spent: counted.map(({ role }) => ({
				role,
				resource: "ult" as const,
				readyAt: readyAfter(state, which, role, at),
			})),
			onCooldown,
		};
	};
	const blue = side("blue");
	const red = side("red");
	const cap = share(top, rules.cap);
	const gap = blue.points - red.points;
	const spent = listed({ blue: blue.spent, red: red.spent });
	const onCooldown = listed({ blue: blue.onCooldown, red: red.onCooldown });
	return {
		points: gap > cap ? cap : gap < -cap ? -cap : gap,
		...(spent ? { spent } : {}),
		...(onCooldown ? { onCooldown } : {}),
	};
}

/** Ultimates ready among the players of `side` up at `second`. */
const readyUp = (state: MatchState, side: Side, second: number) =>
	ROLES.filter(
		(role) =>
			isAlive(state, side, role, second) &&
			ultStatus(state, side, role, second) === "ready",
	).length;

/**
 * Rise, in %, of the chance each side looks for a fight or a pit (U3): the
 * side with more ultimates ready, by the difference, up to the cap. Both are
 * 0 when they are level, so the rolls stay as they were.
 */
export function windowBoost(
	state: MatchState,
	second: number,
): Record<Side, number> {
	const { window, windowCap } = state.context.rules.cooldowns.ult;
	const gap = readyUp(state, "blue", second) - readyUp(state, "red", second);
	const boost = (lead: number) =>
		lead > 0 ? min(lead * window, windowCap) : 0;
	return { blue: boost(gap), red: boost(-gap) };
}
