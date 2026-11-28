import { readFileSync } from "node:fs";
import { encodeLog } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalMatchContent } from "../match/fixtures/content";
import { matchSetup } from "../match/fixtures/setup";
import { playGame } from "../match/play";

/** The match golden of seed 42 as `SIM_VERSION` 18 left it, before #339. */
const before = readFileSync(
	new URL("./fixtures/sim18-42.golden", import.meta.url),
	"utf8",
);

it("C1 · with the ultimates worth nothing and no window, a game is the one of SIM_VERSION 18 byte for byte (#339)", () => {
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
