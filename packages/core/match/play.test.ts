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
