import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after (it changes with SIM_VERSION, 19 since #627).
// #583 changed it once: the real formats now carry stage names and the format
// travels in `season.create`. Without those names the digest is the one of main
// (f85b2437...), so no simulated fact changed.
// #622 changed it once more, with data only: the champions gained
// `ultCooldownTenths`, which moves the content version carried by
// `season.create`. Hashing with the version computed without that field (and its source marks) gives
// 5946c1b7... again, so no simulated fact changed.
// #627 changed it once more: MSI and Worlds declare their real draws (and MSI
// reorders its direct places), and `season.create` carries those formats. With
// the MSI and Worlds formats of main the digest is ecac326e... again, so no
// fact of these days changed; SIM_VERSION 19 is for the drawn brackets.

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "c20badb564eddfbd8b6b02c84067b0c4e58573c35298070c4ffaaea6d0493118",
	});
}, 120_000);

test("playing the days in batches of series keeps the same fact log", () => {
	expect(replayDigest(realSeason(9), 3, undefined, { size: 2 })).toEqual({
		played: 3,
		digest: "c20badb564eddfbd8b6b02c84067b0c4e58573c35298070c4ffaaea6d0493118",
	});
}, 120_000);
