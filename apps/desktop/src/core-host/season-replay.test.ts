import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after (it changes with SIM_VERSION, 18 since #530).
// #583 changed it once: the real formats now carry stage names and the format
// travels in `season.create`. Without those names the digest is the one of main
// (f85b2437...), so no simulated fact changed.
// #622 changed it once more, with data only: the champions gained
// `ultCooldownTenths`, which moves the content version carried by
// `season.create`. Hashing with the version computed without that field gives
// 5946c1b7... again, so no simulated fact changed.

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "d98c184780539d0391e6d88eb7c72c3073a0bcfc28fa6eebb04a813f75f626f4",
	});
}, 120_000);

test("playing the days in batches of series keeps the same fact log", () => {
	expect(replayDigest(realSeason(9), 3, undefined, { size: 2 })).toEqual({
		played: 3,
		digest: "d98c184780539d0391e6d88eb7c72c3073a0bcfc28fa6eebb04a813f75f626f4",
	});
}, 120_000);
