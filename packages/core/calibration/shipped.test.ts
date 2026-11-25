import type { Personality } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { PROFILES } from "../ai/profiles";
import { splitOf } from "./bank";
import { evaluate } from "./metric";
import { personalityOf, realBank, realContent } from "./real-bank";
import { replay } from "./replay";

// The weights before the calibration of #468, frozen here to compare against.
const LEGACY: Record<Personality, Record<string, number>> = {
	balanced: {},
	meta: { meta: 16_000, comfort: 6_000, matchup: 9_000 },
	comfort: { comfort: 35_000, meta: 7_500, targetBan: 14_000 },
	counterpick: {
		matchup: 18_000,
		targetBan: 15_000,
		threatBan: 13_000,
		lookahead: 15_000,
		meta: 8_500,
	},
	pocket: {
		meta: 6_000,
		comfort: 15_000,
		matchup: 8_000,
		targetBan: 7_000,
		threatBan: 7_000,
	},
	architect: { synergy: 19_000, identity: 18_000, meta: 8_500, matchup: 8_500 },
	early: { matchup: 17_500, synergy: 15_000 },
	scaling: { composition: 18_000, threatBan: 20_000 },
	flex: { flex: 22_000 },
	"star-ban": { targetBan: 25_000, meta: 8_000 },
	"pool-drain": {
		targetBan: 20_000,
		fearlessReserve: 20_000,
		lookahead: 16_000,
	},
	"side-lane": { identity: 22_000, threatBan: 16_000 },
};

/** Same seed as `pnpm calibrate`: these drafts were never used to tune the weights. */
const SEED = 468;
const SAMPLE_EVERY = 3;

describe("shipped weights (#468)", () => {
	const content = realContent();
	const turns = realBank()
		.filter((d) => splitOf(d, SEED) === "validation")
		.filter((_, i) => i % SAMPLE_EVERY === 0)
		.flatMap((d) => replay(d, content, personalityOf).turns);

	it("beat the old weights on top 3 over pro drafts held out of the search", () => {
		expect(turns.length).toBeGreaterThan(1_000);
		const before = evaluate(turns, (p) => LEGACY[p]).overall;
		const after = evaluate(turns, (p) => PROFILES[p].weights).overall;
		expect(after.top3).toBeGreaterThan(before.top3);
	}, 600_000);
});
