import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after (it changes with SIM_VERSION, 18 since #530).
// #583 changed it once: the real formats now carry stage names and the format
// travels in `season.create`. Without those names the digest is the one of main
// (f85b2437...), so no simulated fact changed.

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "f08513c30ee0eefe5a97c656072e366877cee91a5502babb8ff02291606b34a5",
	});
}, 120_000);

test("playing the days in batches of series keeps the same fact log", () => {
	expect(replayDigest(realSeason(9), 3, undefined, { size: 2 })).toEqual({
		played: 3,
		digest: "f08513c30ee0eefe5a97c656072e366877cee91a5502babb8ff02291606b34a5",
	});
}, 120_000);
