import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after. #583 changed it once: the real
// formats now carry stage names, and the format travels in `season.create`.

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "4e854502e9d0b88775a060f5a8a42068aef38af698663ac055672c65f6c31bbb",
	});
}, 120_000);

test("playing the days in batches of series keeps the same fact log", () => {
	expect(replayDigest(realSeason(9), 3, undefined, { size: 2 })).toEqual({
		played: 3,
		digest: "4e854502e9d0b88775a060f5a8a42068aef38af698663ac055672c65f6c31bbb",
	});
}, 120_000);
