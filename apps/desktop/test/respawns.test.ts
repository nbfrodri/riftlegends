import type { MatchView } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { respawnCountdowns } from "../src/renderer/match/respawns";

type Fact = MatchView["facts"][number];
type Kill = Extract<Fact, { type: "match.event" }>["kills"][number];

const fight = (minute: number, second: number, kills: Kill[]): Fact => ({
	type: "match.event",
	game: 1,
	minute,
	second,
	kind: "fight",
	side: "blue",
	zone: "lane-mid",
	kills,
	gold: { blue: 0, red: 0 },
	chance: 5000,
	causes: [],
});
const kill = (victim: string, extra: Partial<Kill> = {}): Kill => ({
	killer: "b-top",
	victim,
	assists: [],
	...extra,
});

// Minute 2, second 10 is the game's second 70.
const facts = [
	fight(2, 10, [
		kill("r-top", { respawnAt: 90 }),
		kill("r-mid", { fightSecond: 5, respawnAt: 100 }),
	]),
];

test("a victim is down from his death until he respawns, with the seconds left", () => {
	expect(respawnCountdowns(facts, 69)).toEqual(new Map());
	expect(respawnCountdowns(facts, 70)).toEqual(new Map([["r-top", 20]]));
	expect(respawnCountdowns(facts, 89)).toEqual(
		new Map([
			["r-top", 1],
			["r-mid", 11],
		]),
	);
	expect(respawnCountdowns(facts, 90)).toEqual(new Map([["r-mid", 10]]));
	expect(respawnCountdowns(facts, 100)).toEqual(new Map());
});

test("a kill counts from its second in the fight", () => {
	expect(respawnCountdowns(facts, 74).has("r-mid")).toBe(false);
	expect(respawnCountdowns(facts, 75).get("r-mid")).toBe(25);
});

test("an ace leaves all five down at once", () => {
	const ace = fight(
		20,
		0,
		["r-top", "r-jungle", "r-mid", "r-bot", "r-support"].map((victim, i) =>
			kill(victim, { fightSecond: i, respawnAt: 1200 + 40, ace: i === 4 }),
		),
	);
	const down = respawnCountdowns([ace], 1145);
	expect(down.size).toBe(5);
	expect(down.get("r-support")).toBe(95);
});

test("a later death replaces the earlier one", () => {
	const twice = [...facts, fight(3, 0, [kill("r-top", { respawnAt: 140 })])];
	expect(respawnCountdowns(twice, 125).get("r-top")).toBe(15);
});

test("older logs without respawnAt leave every player's state unknown", () => {
	const old = [fight(2, 10, [kill("r-top")])];
	expect(respawnCountdowns(old, 75)).toEqual(new Map());
});
