import { readFileSync } from "node:fs";
import { encodeLog } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalMatchContent } from "../match/fixtures/content";
import { matchSetup } from "../match/fixtures/setup";
import { playGame } from "../match/play";

/**
 * The match golden of seed 42 before #339 (main at `SIM_VERSION` 19), with the
 * only other change of #339 applied: the top's assist weight of K6 (12 to 8).
 */
const before = readFileSync(
	new URL("./fixtures/neutral-42.golden", import.meta.url),
	"utf8",
);

it("C1 · with the ultimates worth nothing and no window, a game is the one before #339 byte for byte", () => {
	const { rules } = fictionalMatchContent;
	const neutral = {
		...fictionalMatchContent,
		rules: {
			...rules,
			cooldowns: {
				ult: { ...rules.cooldowns.ult, points: 0, keyPoints: 0, window: 0 },
			},
		},
	};
	const facts = playGame(matchSetup({ match: neutral })).facts.map(
		(fact, position) => ({ ...fact, position }),
	);
	expect(encodeLog(facts)).toBe(before.slice(before.indexOf("\n") + 1));
});
