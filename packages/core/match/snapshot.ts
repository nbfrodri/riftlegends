import type {
	MapSnapshot,
	MatchContent,
	MatchEvent,
	Role,
	Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";
import { type MatchState, minuteOf, SOUL } from "./state";
import { trackPlayerStats } from "./stats";

// Cosmetic CS, rounded down: role share × (minute × (6 + farming / 40)
// + 1 CS per 100 gold won in that side's lane contests). Role shares and
// fractional CS use scale 10,000. Support shares bot lane, jungle has no lane.
const CS_BASE = 60_000;
const CS_PER_FARMING = 250;
const CS_PER_LANE_GOLD = 100;
const ROLE_SHARE: Record<Role, number> = {
	top: SCALE,
	jungle: 6_500,
	mid: SCALE,
	bot: SCALE,
	support: 2_000,
};
const ROLE_ZONE: Record<Role, MatchEvent["zone"] | null> = {
	top: "lane-top",
	jungle: null,
	mid: "lane-mid",
	bot: "lane-bot",
	support: "lane-bot",
};

const side = (state: MatchState, which: Side): MapSnapshot["blue"] => {
	const s = state[which];
	/** The minute a timer ends, or null once it has ended. */
	const until = (minute: number) => (minute > state.minute ? minute : null);
	return {
		gold: s.gold,
		kills: s.kills,
		towers: { ...s.towers },
		nexusTowers: s.nexusTowers,
		inhibitors: {
			top: until(s.inhibitors.top),
			mid: until(s.inhibitors.mid),
			bot: until(s.inhibitors.bot),
		},
		dragons: s.dragons,
		soul: s.dragons >= SOUL,
		grubs: s.grubs,
		heralds: s.heralds,
		barons: s.barons,
		elders: s.elders,
		buffs: {
			herald: until(s.buffs.herald),
			baron: until(s.buffs.baron),
			elder: until(s.buffs.elder),
		},
	};
};

/** Captures plain JSON snapshots while processing only the new minute's events. */
export function trackSnapshots(initial: MatchState, content: MatchContent) {
	const stats = trackPlayerStats(initial.context, initial.context.rules);
	const farming = new Map(
		content.players.map((p) => [p.id, p.attributes.farming]),
	);
	const laneGold = {
		blue: new Map<MatchEvent["zone"], number>(),
		red: new Map<MatchEvent["zone"], number>(),
	};

	return (
		state: MatchState,
		events: readonly MatchEvent[],
		elapsed: number,
	): MapSnapshot => {
		for (const event of events) {
			stats.record(event);
			if (event.kind === "lane") {
				const gold = laneGold[event.side];
				gold.set(
					event.zone,
					(gold.get(event.zone) ?? 0) + event.gold[event.side],
				);
			}
		}
		return {
			minute: state.minute,
			blue: side(state, "blue"),
			red: side(state, "red"),
			players: stats.at(
				minuteOf(elapsed),
				({ player, role, side }, { kills, deaths, assists }, gold) => {
					const zone = ROLE_ZONE[role];
					const won = zone ? (laneGold[side].get(zone) ?? 0) : 0;
					const rate = CS_BASE + (farming.get(player) ?? 0) * CS_PER_FARMING;
					const scaled =
						(state.minute * rate + won * CS_PER_LANE_GOLD) * ROLE_SHARE[role];
					const scale = SCALE * SCALE;
					const cs = (scaled - (scaled % scale)) / scale;
					return { player, kills, deaths, assists, gold, cs };
				},
			),
		};
	};
}
