import {
	type MatchContent,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";

/** Integer division of non-negative numbers, rounding down. */
const div = (n: number, d: number) => (n - (n % d)) / d;

/**
 * Splits `total` by `weights` into integers that add up to `total`: each part
 * rounds down and the rest goes one by one to the largest remainders, ties to
 * the earlier index (so `ROLES` order for roles).
 */
export function split(total: number, weights: readonly number[]): number[] {
	const sum = weights.reduce((a, b) => a + b, 0);
	if (sum === 0 || total === 0) return weights.map(() => 0);
	const parts = weights.map((w) => div(total * w, sum));
	const order = weights
		.map((w, index) => ({ index, rest: (total * w) % sum }))
		.sort((a, b) => b.rest - a.rest || a.index - b.index);
	let left = total - parts.reduce((a, b) => a + b, 0);
	for (const { index } of order) {
		if (left === 0) break;
		parts[index] = (parts[index] as number) + 1;
		left -= 1;
	}
	return parts;
}

const weightsOf = (shares: Partial<Record<Role, number>>) =>
	ROLES.map((role) => shares[role] ?? 0);

const EQUAL = weightsOf({ top: 1, jungle: 1, mid: 1, bot: 1, support: 1 });

/**
 * Share of the passive income each role farms, per 10,000 (plan 08, #347):
 * the pro share of gold minus what kills, structures and objectives add. The
 * support farms little; the ADC the most. Calibrated by K7.
 */
export const FARM_SHARE: Record<Role, number> = {
	top: 1660,
	jungle: 2560,
	mid: 1800,
	bot: 2720,
	support: 1260,
};

/** Who farms a lane: the bottom lane is the ADC's, with a taste for the support. */
const LANE_SHARE: Record<string, readonly number[]> = {
	"lane-top": weightsOf({ top: 1 }),
	"lane-mid": weightsOf({ mid: 1 }),
	"lane-bot": weightsOf({ bot: 80, support: 20 }),
};

/** The gold of an event that no kill paid, by role: lane gold goes to its laners. */
export function restOfEvent(
	event: Pick<MatchEvent, "kind" | "zone" | "tier">,
	amount: number,
): number[] {
	const lane = LANE_SHARE[event.zone];
	if (event.kind === "lane" && lane) return split(amount, lane);
	// A tower pays half to the roles of its lane and half to the five.
	if (event.kind === "tower" && event.tier !== 4 && lane) {
		const own = amount - div(amount, 2);
		const byLane = split(own, lane);
		const shared = split(amount - own, EQUAL);
		return byLane.map((n, i) => n + (shared[i] as number));
	}
	return split(amount, EQUAL);
}

/** Where a player plays: its side and its index in `ROLES`. */
export interface Slot {
	readonly side: Side;
	readonly index: number;
}

/**
 * Gold each player earned in one event, by side and role (the passive income
 * is not here): kills and assists pay who made them, each side from what it
 * earned in the event and never more; the rest goes by `restOfEvent`.
 */
export function paidByRole(
	event: MatchEvent,
	slots: ReadonlyMap<string, Slot>,
	economy: MatchContent["rules"]["economy"],
): Record<Side, number[]> {
	const paid = { blue: ROLES.map(() => 0), red: ROLES.map(() => 0) };
	const left = { blue: event.gold.blue, red: event.gold.red };
	const pay = (side: Side, slot: Slot, amount: number) => {
		const given = amount < left[side] ? amount : left[side];
		paid[slot.side][slot.index] =
			(paid[slot.side][slot.index] as number) + given;
		left[side] -= given;
	};
	for (const k of event.kills) {
		const killer = slots.get(k.killer);
		// In a fight both sides can score: a kill is its killer's side's.
		const side = killer?.side ?? event.side;
		if (killer) pay(side, killer, economy.kill);
		// One bag per kill, split among the assistants; the first takes the rest.
		const share = div(economy.assist, k.assists.length || 1);
		for (const [index, id] of k.assists.entries()) {
			const helper = slots.get(id);
			if (helper)
				pay(
					side,
					helper,
					index === 0 ? economy.assist - share * (k.assists.length - 1) : share,
				);
		}
	}
	for (const side of ["blue", "red"] as const) {
		restOfEvent(event, left[side]).forEach((gold, i) => {
			paid[side][i] = (paid[side][i] as number) + gold;
		});
	}
	return paid;
}

/** Passive income of `minutes`, by role. */
export const farmed = (passive: number, minutes: number): number[] =>
	split(passive * minutes, weightsOf(FARM_SHARE));

/**
 * Damage dealt to champions by role, per 10,000 (plan 08 table, Leaguepedia):
 * the base of the team split, before the performance of each player.
 */
export const DAMAGE_SHARE: Record<Role, number> = {
	top: 2256,
	jungle: 1672,
	mid: 2470,
	bot: 2812,
	support: 790,
};
/** Parts of the damage split that follow the role and the performance (of 10). */
const ROLE_PART = 9;
const PERFORMANCE_PART = 1;

/**
 * Splits the team's damage: 90 % by the damage of its role and 10 % by what
 * each player did (kills, assists, fights, farm), so a carry that snowballs
 * deals more and the sum stays the team's damage.
 */
export function splitDamage(own: readonly number[]): number[] {
	const team = own.reduce((a, b) => a + b, 0);
	return split(
		team,
		ROLES.map(
			(role, i) =>
				ROLE_PART * DAMAGE_SHARE[role] * team +
				PERFORMANCE_PART * SCALE * (own[i] as number),
		),
	);
}
