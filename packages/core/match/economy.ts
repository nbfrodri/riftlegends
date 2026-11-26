import {
	type MatchContent,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";
import { deadNow, lostInMinute } from "./dead-passive";
import type { MatchState } from "./state";

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
	top: 1738,
	jungle: 2456,
	mid: 1874,
	bot: 2662,
	support: 1270,
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
		if (killer)
			pay(
				side,
				killer,
				economy.kill + (k.firstBlood?.killerGold ?? 0) + (k.shutdown ?? 0),
			);
		// One bag per kill, split among the assistants; the first takes the rest.
		const bag = economy.assist + (k.firstBlood?.assistGold ?? 0);
		const share = div(bag, k.assists.length || 1);
		for (const [index, id] of k.assists.entries()) {
			const helper = slots.get(id);
			if (helper)
				pay(
					side,
					helper,
					index === 0 ? bag - share * (k.assists.length - 1) : share,
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

/** Passive income of one minute, by role. */
export const farmed = (income: number): number[] =>
	split(income, weightsOf(FARM_SHARE));

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

export interface SideEconomy {
	readonly gold: number;
	/** Gold each player earned, by role: events and passive income. */
	readonly paid: readonly number[];
	readonly kills: number;
}

/**
 * Adds the passive income of `minute` to a side, by role. A player still down
 * from a death in an earlier minute loses what the seconds down in this one
 * farm (plan 08, #528); `deadNow` takes the part of a death in its own minute.
 */
export function earnPassive(
	state: MatchState,
	side: Side,
	minute: number,
): MatchState[Side] {
	const own = state[side];
	const income = state.context.rules.economy.passive;
	const { farm } = state.context;
	const down = ROLES.map((role, i) =>
		lostInMinute(
			farm[i] as number,
			own.players[role].diedAt,
			own.players[role].respawnAt,
			minute,
		),
	);
	return {
		...own,
		gold: own.gold + income - down.reduce((a, b) => a + b, 0),
		paid: own.paid.map(
			(gold, i) => gold + (farm[i] as number) - (down[i] as number),
		),
	};
}

/** Credits both sides with their gold and kills from one event. */
export function markEconomy(state: MatchState, e: MatchEvent, loserSide: Side) {
	const winner = state[e.side];
	const loser = state[loserSide];
	let loserKills = 0;
	if (e.kind === "fight") {
		const loserPlayers = Object.values(state.context[loserSide].players);
		loserKills = e.kills.filter((kill) =>
			loserPlayers.includes(kill.killer),
		).length;
	}
	const { slots, rules } = state.context;
	const paid = paidByRole(e, slots, rules.economy);
	const down = deadNow(e, slots, state.context.farm);
	const earned = (own: SideEconomy, side: Side) =>
		own.paid.map(
			(gold, i) => gold + (paid[side][i] as number) - (down[side][i] as number),
		);
	const lostGold = (side: Side) => down[side].reduce((a, b) => a + b, 0);
	const won = {
		...winner,
		gold: winner.gold + e.gold[e.side] - lostGold(e.side),
		paid: earned(winner, e.side),
		kills: winner.kills + e.kills.length - loserKills,
	};
	const lost = {
		...loser,
		gold: loser.gold + e.gold[loserSide] - lostGold(loserSide),
		paid: earned(loser, loserSide),
		kills: loser.kills + loserKills,
	};
	return { won, lost };
}
