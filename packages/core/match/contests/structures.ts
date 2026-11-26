import type { Side } from "@rift-legends/contracts";
import { int } from "../../rng/helpers";
import { gameSecond } from "../player-state";
import {
	GRUBS,
	inhibitorDown,
	LANES,
	type Lane,
	type MatchState,
	other,
} from "../state";
import { type Contest, type ContestEvent, paid, roll } from "./contest";
import { edge, outcome } from "./edge";

/** First minute teams push for structures, once the lanes are over. */
const PUSH_FROM = 12;
/** Chance, per 10,000, that a won push takes a structure. Balance constants. */
const TAKE = 2200;
/** Share of that chance, in percent, that a push takes an inhibitor. */
const INHIBITOR_PERCENT = 58;
/** No game ends before this minute: the nexus cannot be taken earlier. */
export const NEXUS_FROM = 21;
/**
 * A push of the minute takes the nexus with this share, in percent, of the
 * chance, plus a share more per minute after the 30th. Most games end in the
 * window after a won fight instead (plan 08, #530).
 */
const NEXUS_PERCENT = 2;
const NEXUS_RAMP = 3;
const NEXUS_RAMP_FROM = 30;
const BUFF_TAKE = { herald: 2500, baron: 4000, elder: 5000 } as const;
/** Extra chance per grub stack, and for the voidmites of the third. */
const GRUB_TAKE = 100;
const VOIDMITES_TAKE = 150;

export type Loss = Pick<
	MatchState["blue"],
	"towers" | "nexusTowers" | "inhibitors"
>;

export type Target =
	| { readonly kind: "tower"; readonly tier: 1 | 2 | 3 | 4 }
	| { readonly kind: "inhibitor" }
	| { readonly kind: "nexus" };

/**
 * The next structure of `loser` the push in `lane` reaches, if any. The nexus
 * is reached only when `closing`: a push of the minute never ends the game,
 * only a window after a won fight does (plan 08, #530).
 */
export function target(
	loser: Loss,
	lane: Lane,
	minute: number,
	closing = false,
): Target | null {
	if (loser.towers[lane] < 3) {
		return { kind: "tower", tier: (loser.towers[lane] + 1) as 1 | 2 | 3 };
	}
	if (loser.inhibitors[lane] <= minute) return { kind: "inhibitor" };
	if (loser.nexusTowers < 2) return { kind: "tower", tier: 4 };
	if (closing && inhibitorDown(loser as MatchState["blue"], minute)) {
		return { kind: "nexus" };
	}
	return null;
}

/**
 * What taking `next` in `lane` is: the event, with the `winner`'s gold, and
 * the structures `loser` has left after it.
 */
export function structureEvent(
	next: Target,
	lane: Lane,
	winner: Side,
	loss: Loss,
	minute: number,
	economy: MatchState["context"]["rules"]["economy"],
	base: Pick<ContestEvent, "side" | "second" | "kills" | "chance" | "causes">,
): { event: ContestEvent; loss: Loss } {
	const atBase = `base-${other(winner)}` as const;
	if (next.kind === "nexus") {
		return {
			event: { ...base, kind: "nexus", zone: atBase, gold: paid(winner, 0) },
			loss,
		};
	}
	if (next.kind === "inhibitor") {
		return {
			event: {
				...base,
				kind: "inhibitor",
				zone: `lane-${lane}`,
				gold: paid(winner, economy.inhibitor),
			},
			// Down from now on; the state sets its respawn.
			loss: { ...loss, inhibitors: { ...loss.inhibitors, [lane]: minute + 1 } },
		};
	}
	const gold = paid(winner, economy.tower);
	return next.tier < 4
		? {
				event: {
					...base,
					kind: "tower",
					tier: next.tier,
					zone: `lane-${lane}`,
					gold,
				},
				loss: { ...loss, towers: { ...loss.towers, [lane]: next.tier } },
			}
		: {
				event: { ...base, kind: "tower", tier: 4, zone: atBase, gold },
				loss: { ...loss, nexusTowers: loss.nexusTowers + 1 },
			};
}

/** Chance, per 10,000, that a push won by `winner` takes a structure. */
export function takeChance(state: MatchState, winner: Side) {
	const { buffs, grubs } = state[winner];
	let chance = TAKE + grubs * GRUB_TAKE;
	if (grubs >= GRUBS) chance += VOIDMITES_TAKE;
	for (const buff of ["herald", "baron", "elder"] as const) {
		if (buffs[buff] > state.minute) chance += BUFF_TAKE[buff];
	}
	return chance;
}

/** Chance, per 10,000, that a push won by `winner` takes `next`. */
function pushChance(state: MatchState, winner: Side, next: Target) {
	const chance = takeChance(state, winner);
	if (next.kind === "inhibitor") return (chance * INHIBITOR_PERCENT) / 100;
	if (next.kind !== "nexus") return chance;
	const late =
		state.minute > NEXUS_RAMP_FROM ? state.minute - NEXUS_RAMP_FROM : 0;
	return (chance * (NEXUS_PERCENT + NEXUS_RAMP * late)) / 100;
}

/**
 * Each minute, each lane is pushed by whoever wins it; a push may take the
 * next structure in order: three towers, the inhibitor, two nexus towers and
 * the nexus, which can only fall while one of its inhibitors is down.
 */
const push: Contest = {
	id: 20,
	due: (state) => state.minute >= PUSH_FROM,
	resolve(state, rng, first) {
		const lost: Record<Side, Loss> = { blue: state.blue, red: state.red };
		const events: ContestEvent[] = [];
		// The first push is at the contest's second, the others come after it.
		const seconds = [
			first,
			...LANES.slice(1).map(() => int(rng, first, 59)),
		].sort((a, b) => a - b);
		const { economy } = state.context.rules;
		for (const lane of LANES) {
			const result = edge(
				state,
				"siege",
				{},
				undefined,
				gameSecond(state.minute, first),
			);
			const winner: Side = roll(rng, result.blue) ? "blue" : "red";
			const loser = other(winner);
			const next = target(
				lost[loser],
				lane,
				state.minute,
				state.minute >= NEXUS_FROM,
			);
			if (!next || !roll(rng, pushChance(state, winner, next))) continue;
			const taken = structureEvent(
				next,
				lane,
				winner,
				lost[loser],
				state.minute,
				economy,
				{
					side: winner,
					second: seconds[events.length] ?? 59,
					kills: [],
					...outcome(result, winner),
				},
			);
			lost[loser] = taken.loss;
			events.push(taken.event);
		}
		return events;
	},
};

export const STRUCTURE_CONTESTS: readonly Contest[] = [push];
