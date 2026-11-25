import { decodeFact, draftFacts, encodeFact } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { matchSetup } from "./fixtures/setup";
import { playGame } from "./play";

const facts = (seed = 42) => playGame(matchSetup({ seed })).facts;

describe("playGame", () => {
	it("emits match.started, its events and match.ended, all valid facts", () => {
		const list = facts();
		expect(list[0]?.type).toBe("match.started");
		expect(list.at(-1)?.type).toBe("match.ended");
		const events = list.slice(1, -1);
		expect(events.length).toBeGreaterThan(10);
		expect(events.every((f) => f.type === "match.event")).toBe(true);
		list.forEach((fact, position) => {
			const line = encodeFact({ ...fact, position });
			expect(decodeFact(draftFacts, line)).toEqual({ ...fact, position });
		});
	});

	it("is the same game for the same seed", () => {
		expect(facts(7)).toEqual(facts(7));
		expect(facts(7)).not.toEqual(facts(8));
	});

	it("names the team whose side destroyed the nexus", () => {
		const { winner, events, facts: list } = playGame(matchSetup());
		const nexus = events.find((e) => e.kind === "nexus");
		const ended = list.at(-1);
		expect(winner).toBe(nexus?.side === "blue" ? "forge" : "shoal");
		expect(ended).toMatchObject({ winner });
	});

	it("points the decisive contests at events the winner won", () => {
		const { winner, events, facts: list } = playGame(matchSetup());
		const ended = list.at(-1) as unknown as { decisive: { event: number }[] };
		expect(ended.decisive.length).toBeGreaterThan(0);
		const side = winner === "forge" ? "blue" : "red";
		for (const { event } of ended.decisive) {
			expect(events[event]?.side).toBe(side);
		}
	});
});

it("reports timed multikills from the simulated fights in match.ended", () => {
	const games = Array.from({ length: 24 }, (_, seed) =>
		playGame(matchSetup({ seed })),
	);
	const expected = games.map(({ events }) =>
		events.flatMap((event, index) =>
			event.kills.flatMap((kill) =>
				"multikill" in kill
					? [{ event: index, killer: kill.killer, count: kill.multikill }]
					: [],
			),
		),
	);
	expect(expected.flat().length).toBeGreaterThan(0);
	expect(games.map(({ facts }) => facts.at(-1))).toEqual(
		expected.map((multikills) => expect.objectContaining({ multikills })),
	);
	for (const { events } of games) {
		for (const event of events.filter((e) => e.kind === "fight")) {
			const times = event.kills.map((kill) =>
				"fightSecond" in kill ? kill.fightSecond : undefined,
			);
			expect(times[0]).toBe(0);
			for (let i = 1; i < times.length; i++) {
				expect(times[i]).toBeGreaterThan(times[i - 1] as number);
			}
		}
	}
});
