import type { Personality } from "@rift-legends/contracts";
import { type Fixed, SCALE } from "../math";
import type { Weights } from "./choose";

export interface Profile {
	readonly weights: Weights;
	/** Fixed multiplier of the difficulty's temperature. */
	readonly temperature: number;
	/** Places added to the difficulty's pool. */
	readonly pool: number;
	/** Fixed multiplier of the difficulty's wildcard chance. */
	readonly wildcard: number;
}

const balanced: Profile = {
	weights: {},
	temperature: SCALE,
	pool: 0,
	wildcard: SCALE,
};

export const PROFILES: Record<Personality, Profile> = {
	balanced,
	// One draw policy covers picks and bans. Use DraftSim's pick settings where they differ.
	meta: {
		weights: {
			meta: 16_000 as Fixed,
			comfort: 6_000 as Fixed,
			matchup: 9_000 as Fixed,
		},
		temperature: 4_500,
		pool: -1,
		wildcard: 0,
	},
	comfort: {
		...balanced,
		weights: {
			comfort: 35_000 as Fixed,
			meta: 7_500 as Fixed,
			targetBan: 14_000 as Fixed,
		},
		temperature: 9_000,
		wildcard: 20_000,
	},
	counterpick: {
		...balanced,
		weights: {
			matchup: 18_000 as Fixed,
			targetBan: 15_000 as Fixed,
			threatBan: 13_000 as Fixed,
			lookahead: 15_000 as Fixed,
			meta: 8_500 as Fixed,
		},
		temperature: 8_000,
	},
	pocket: {
		weights: {
			meta: 6_000 as Fixed,
			comfort: 15_000 as Fixed,
			matchup: 8_000 as Fixed,
			targetBan: 7_000 as Fixed,
			threatBan: 7_000 as Fixed,
		},
		temperature: 22_000,
		pool: 3,
		wildcard: 60_000,
	},
	architect: {
		...balanced,
		weights: {
			synergy: 19_000 as Fixed,
			identity: 18_000 as Fixed,
			meta: 8_500 as Fixed,
			matchup: 8_500 as Fixed,
		},
		temperature: 9_000,
	},
	// Lane advantage and skirmish combos stand in for early power and priority.
	early: {
		...balanced,
		weights: { matchup: 17_500 as Fixed, synergy: 15_000 as Fixed },
	},
	// Coverage rewards peel and carry picks. Threat bans protect them from dive.
	scaling: {
		...balanced,
		weights: { composition: 18_000 as Fixed, threatBan: 20_000 as Fixed },
	},
	flex: { ...balanced, weights: { flex: 22_000 as Fixed } },
	"star-ban": {
		...balanced,
		weights: { targetBan: 25_000 as Fixed, meta: 8_000 as Fixed },
	},
	// Target bans deny known comfort. Reserve and lookahead value future options.
	"pool-drain": {
		...balanced,
		weights: {
			targetBan: 20_000 as Fixed,
			fearlessReserve: 20_000 as Fixed,
			lookahead: 16_000 as Fixed,
		},
	},
	// Identity rewards an established splitpush plan. Threat bans can remove engage.
	"side-lane": {
		...balanced,
		weights: { identity: 22_000 as Fixed, threatBan: 16_000 as Fixed },
	},
};
