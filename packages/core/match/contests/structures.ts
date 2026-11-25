import type { Side } from "@rift-legends/contracts";
import { int } from "../../rng/helpers";
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
const TAKE = 2700;
const BUFF_TAKE = { herald: 2500, baron: 4000, elder: 5000 } as const;
/** Extra chance per grub stack, and for the voidmites of the third. */
const GRUB_TAKE = 100;
const VOIDMITES_TAKE = 150;

type Loss = Pick<MatchState["blue"], "towers" | "nexusTowers" | "inhibitors">;

/** The next structure of `loser` the push in `lane` reaches, if any. */
function target(loser: Loss, lane: Lane, minute: number) {
	if (loser.towers[lane] < 3) {
		return { kind: "tower", tier: loser.towers[lane] + 1 } as const;
	}
	if (loser.inhibitors[lane] <= minute) return { kind: "inhibitor" } as const;
	if (loser.nexusTowers < 2) return { kind: "tower", tier: 4 } as const;
	if (inhibitorDown(loser as MatchState["blue"], minute)) {
		return { kind: "nexus" } as const;
	}
	return null;
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

/**
 * Each minute, each lane is pushed by whoever wins it; a push may take the
 * next structure in order: three towers, the inhibitor, two nexus towers and
 * the nexus, which can only fall while one of its inhibitors is down.
 */
const push: Contest = {
	id: 20,
	due: (state) => state.minute >= PUSH_FROM,
	resolve(state, rng) {
		const lost: Record<Side, Loss> = { blue: state.blue, red: state.red };
		const events: ContestEvent[] = [];
		const seconds = LANES.map(() => int(rng, 0, 59)).sort((a, b) => a - b);
		const { economy } = state.context.rules;
		for (const lane of LANES) {
			const result = edge(state, "siege");
			const winner: Side = roll(rng, result.blue) ? "blue" : "red";
			const loser = other(winner);
			const next = target(lost[loser], lane, state.minute);
			if (!next || !roll(rng, takeChance(state, winner))) continue;
			const base = {
				side: winner,
				second: seconds[events.length] ?? 59,
				kills: [],
				...outcome(result, winner),
			};
			const atBase = `base-${loser}` as const;
			const loss = lost[loser];
			if (next.kind === "tower" && next.tier < 4) {
				lost[loser] = {
					...loss,
					towers: { ...loss.towers, [lane]: next.tier },
				};
				events.push({
					...base,
					kind: "tower",
					tier: next.tier,
					zone: `lane-${lane}`,
					gold: paid(winner, economy.tower),
				});
			} else if (next.kind === "inhibitor") {
				lost[loser] = {
					...loss,
					// Down from now on; the state sets its respawn.
					inhibitors: { ...loss.inhibitors, [lane]: state.minute + 1 },
				};
				events.push({
					...base,
					kind: "inhibitor",
					zone: `lane-${lane}`,
					gold: paid(winner, economy.inhibitor),
				});
			} else if (next.kind === "tower") {
				lost[loser] = { ...loss, nexusTowers: loss.nexusTowers + 1 };
				events.push({
					...base,
					kind: "tower",
					tier: 4,
					zone: atBase,
					gold: paid(winner, economy.tower),
				});
			} else {
				events.push({
					...base,
					kind: "nexus",
					zone: atBase,
					gold: paid(winner, 0),
				});
				break;
			}
		}
		return events;
	},
};

export const STRUCTURE_CONTESTS: readonly Contest[] = [push];
