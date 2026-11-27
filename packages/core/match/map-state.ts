import type { MatchEvent } from "@rift-legends/contracts";
import { minuteOf } from "./objective-state";

export type Lane = "top" | "mid" | "bot";
export const LANES: readonly Lane[] = ["top", "mid", "bot"];

export interface SideMap {
	/** Towers this side has lost in each lane (0–3) and at its nexus (0–2). */
	readonly towers: Readonly<Record<Lane, number>>;
	readonly nexusTowers: number;
	/** Minute each lost inhibitor is back; it is down while that is later. */
	readonly inhibitors: Readonly<Record<Lane, number>>;
}

export const inhibitorDown = (side: SideMap, minute: number) =>
	LANES.some((lane) => side.inhibitors[lane] > minute);

const lane = (event: MatchEvent) => event.zone.slice("lane-".length) as Lane;

export function markStructure<T extends SideMap>(
	lost: T,
	e: MatchEvent,
	inhibitorRespawn: number,
): T {
	if (e.kind === "inhibitor") {
		return {
			...lost,
			inhibitors: {
				...lost.inhibitors,
				[lane(e)]: e.minute + minuteOf(inhibitorRespawn),
			},
		};
	}
	return e.tier === 4
		? { ...lost, nexusTowers: lost.nexusTowers + 1 }
		: {
				...lost,
				towers: { ...lost.towers, [lane(e)]: lost.towers[lane(e)] + 1 },
			};
}
