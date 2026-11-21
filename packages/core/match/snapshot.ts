import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { type MatchState, SOUL } from "./state";

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

/** The map at the end of the state's minute, as plain JSON (plan 09, Q4). */
export const snapshotOf = (state: MatchState): MapSnapshot => ({
	minute: state.minute,
	blue: side(state, "blue"),
	red: side(state, "red"),
});
