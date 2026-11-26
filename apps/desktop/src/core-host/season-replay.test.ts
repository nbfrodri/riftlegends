import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after (it changes with SIM_VERSION, 17 since #529).

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "f85b243735cbc4921849c364df4930f8f74075755e9b16f7e400f4cf800914b8",
	});
}, 120_000);

test("playing the days in batches of series keeps the same fact log", () => {
	expect(replayDigest(realSeason(9), 3, undefined, { size: 2 })).toEqual({
		played: 3,
		digest: "f85b243735cbc4921849c364df4930f8f74075755e9b16f7e400f4cf800914b8",
	});
}, 120_000);
