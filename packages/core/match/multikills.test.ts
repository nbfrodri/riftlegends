import { expect, it } from "vitest";
import type { ContestEvent } from "./contests/contest";
import { matchSetup } from "./fixtures/setup";
import { playMinute } from "./loop";
import { createMatch } from "./state";

const killsAt = (seconds: number[]) =>
	seconds.map((fightSecond, index) => ({
		killer: "blue-bot",
		victim: `red-${index}`,
		assists: [],
		fightSecond,
	}));

function fight(kills: ReturnType<typeof killsAt>): ContestEvent {
	return {
		kind: "fight",
		side: "blue",
		zone: "baron-pit",
		second: 55,
		kills,
		gold: { blue: 0, red: 0 },
		chance: 5000,
		causes: [],
	};
}

function resolve(...events: ContestEvent[]) {
	return playMinute(createMatch(matchSetup()), [
		{ id: 99, due: () => true, resolve: () => events },
	]).events;
}

it.each([
	{ seconds: [0, 10], counts: [2] },
	{ seconds: [0, 10, 20], counts: [3] },
	{ seconds: [0, 10, 20, 30], counts: [4] },
	{ seconds: [0, 10, 20, 30, 60], counts: [5] },
	{ seconds: [0, 10, 20, 30, 61], counts: [4] },
	{ seconds: [0, 11, 21], counts: [2] },
	{ seconds: [0, 11], counts: [] },
])("records the highest tier per chain at $seconds", ({ seconds, counts }) => {
	const [event] = resolve(fight(killsAt(seconds)));
	expect(
		event?.kills.flatMap((kill) =>
			"multikill" in kill ? [kill.multikill] : [],
		),
	).toEqual(counts);
});

it("requires the same author and fight, and awards the tier on its finishing kill", () => {
	const [first, second, third] = killsAt([0, 4, 10]);
	if (!first || !second || !third) throw new Error("missing fixture kills");
	const [one, two] = resolve(fight([first]), fight([second]));
	expect(one?.kills[0]).not.toHaveProperty("multikill");
	expect(two?.kills[0]).not.toHaveProperty("multikill");

	const [event] = resolve(
		fight([first, { ...second, killer: "blue-mid" }, third]),
	);
	expect(event?.kills[1]).not.toHaveProperty("multikill");
	expect(event?.kills[2]).toHaveProperty("multikill", 2);
});

it("does not turn a respawned victim into the fifth distinct kill", () => {
	const kills = killsAt([0, 5, 10, 15, 40]);
	const fifth = kills[4];
	if (!fifth) throw new Error("missing fifth kill");
	fifth.victim = "red-0";
	const [event] = resolve(fight(kills));
	expect(event?.kills[3]).toHaveProperty("multikill", 4);
	expect(event?.kills[4]).not.toHaveProperty("multikill");
});

it("does not extend a chain through its author's death", () => {
	const kills = killsAt([0, 4, 8, 12, 20]);
	kills.splice(4, 0, {
		killer: "red-support",
		victim: "blue-bot",
		assists: [],
		fightSecond: 16,
	});
	const [event] = resolve(fight(kills));
	expect(event?.kills[3]).toHaveProperty("multikill", 4);
	expect(event?.kills[5]).not.toHaveProperty("multikill");
});
