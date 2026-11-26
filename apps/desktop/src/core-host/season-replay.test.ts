import { expect, test } from "vitest";
import { realSeason, replayDigest } from "./season-replay.fixtures";

// Speed work on the season (#584) must not change a single fact: the log of a
// fixed seed hashes the same before and after.

test("the first match days of the real season keep their fact log", () => {
	expect(replayDigest(realSeason(9), 3)).toEqual({
		played: 3,
		digest: "ee8023332807c67ca63b981584244ade1df636cd347bfac783f83653b355477a",
	});
}, 120_000);
