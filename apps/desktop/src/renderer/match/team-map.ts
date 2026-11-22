import type { MapSnapshot, Side } from "@rift-legends/contracts";

// One team's base and objectives, read from a map snapshot. Pure, so the match
// panels and the minimap (plan 23) share the same reading of the map.

export const LANES = ["top", "mid", "bot"] as const;
/** Lane towers from the outside in: they fall in this order. */
export const TIERS = ["outer", "inner", "base"] as const;
const NEXUS_TOWERS = 2;
const TOTAL_TOWERS = LANES.length * TIERS.length + NEXUS_TOWERS;

export type Lane = (typeof LANES)[number];
export type Tier = (typeof TIERS)[number];
export type Buff = keyof MapSnapshot[Side]["buffs"];

export interface TeamMap {
	towers: { standing: number; total: number };
	lanes: {
		lane: Lane;
		towers: { tier: Tier; standing: boolean }[];
		/** `respawnIn`: seconds until a destroyed inhibitor is back. */
		inhibitor: { standing: boolean; respawnIn: number | null };
	}[];
	nexus: { standing: boolean; towers: boolean[] };
	objectives: {
		dragons: number;
		soul: boolean;
		heralds: number;
		barons: number;
		elders: number;
	};
	/** Active buffs with their remaining seconds. */
	effects: { kind: Buff; remaining: number }[];
}

const left = (minute: number, second: number) =>
	Math.max(0, minute * 60 - second);

/** A side's view of `map` at `second` of the game; `nexusDown` once its nexus falls. */
export function teamMap(
	map: MapSnapshot[Side],
	second: number,
	nexusDown = false,
): TeamMap {
	const lanes = LANES.map((lane) => {
		const back = map.inhibitors[lane];
		return {
			lane,
			towers: TIERS.map((tier, index) => ({
				tier,
				standing: map.towers[lane] <= index,
			})),
			inhibitor: {
				standing: back === null,
				respawnIn: back === null ? null : left(back, second),
			},
		};
	});
	const lost =
		LANES.reduce((sum, lane) => sum + map.towers[lane], 0) + map.nexusTowers;
	const buffs: Buff[] = ["herald", "baron", "elder"];
	return {
		towers: { standing: TOTAL_TOWERS - lost, total: TOTAL_TOWERS },
		lanes,
		nexus: {
			standing: !nexusDown,
			towers: Array.from(
				{ length: NEXUS_TOWERS },
				(_, index) => map.nexusTowers <= index,
			),
		},
		objectives: {
			dragons: map.dragons,
			soul: map.soul,
			heralds: map.heralds,
			barons: map.barons,
			elders: map.elders,
		},
		effects: buffs.flatMap((kind) => {
			const until = map.buffs[kind];
			const remaining = until === null ? 0 : left(until, second);
			return remaining > 0 ? [{ kind, remaining }] : [];
		}),
	};
}
