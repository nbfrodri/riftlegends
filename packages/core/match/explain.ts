import type { MatchEvent, Side } from "@rift-legends/contracts";
import { SCALE } from "../math";

/** An event as stored in the fact log. */
export type EventFact = MatchEvent & { position: number };

/** What each kind of contest is worth, per 10,000: fights and objectives weigh most. */
const WEIGHT: Record<MatchEvent["kind"], number> = {
	fight: 10000,
	baron: 10000,
	elder: 10000,
	siege: 7000,
	dragon: 6000,
	inhibitor: 5000,
	herald: 4000,
	tower: 4000,
	kill: 3000,
	gank: 3000,
	lane: 2000,
	/** The end of the game says nothing about why it was won. */
	nexus: 0,
};

const LIMIT = 3;

/**
 * The (up to) three contests the winner won that weighed the most.
 * `swing` = (10,000 - chance) x weight of the kind: beating the odds in a
 * fight counts more than a lane edge. Ties keep the earlier event first.
 */
export function decisive(
	events: readonly EventFact[],
	winner: Side,
): { event: number; swing: number }[] {
	return events
		.filter((e) => e.side === winner && WEIGHT[e.kind] > 0)
		.map((e) => {
			const scaled = (SCALE - e.chance) * WEIGHT[e.kind];
			return { event: e.position, swing: (scaled - (scaled % SCALE)) / SCALE };
		})
		.sort((a, b) => b.swing - a.swing || a.event - b.event)
		.slice(0, LIMIT);
}
