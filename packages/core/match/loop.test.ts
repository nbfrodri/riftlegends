import type { MatchContent, MatchEvent } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { deadThrough } from "./dead-passive";
import { farmed } from "./economy";
import { fictionalMatchContent } from "./fixtures/content";
import { matchSetup } from "./fixtures/setup";
import { type Contest, LANE_CONTESTS, playMatch, playMinute } from "./loop";
import { createMatch, type MatchState } from "./state";

const setup = matchSetup;

function run(
	minutes: number,
	from = setup(),
	contests: readonly Contest[] = LANE_CONTESTS,
) {
	let state: MatchState = createMatch(from);
	const events: MatchEvent[] = [];
	for (let i = 0; i < minutes; i++) {
		const next = playMinute(state, contests);
		events.push(...next.events);
		state = next.state;
	}
	return { state, events };
}

/** A contest that blows up the red nexus at a given minute. */
const nexusAt = (minute: number): Contest => ({
	id: 99,
	due: (state) => state.minute === minute,
	resolve: () => [
		{
			kind: "nexus",
			side: "blue",
			zone: "base-red",
			second: 30,
			kills: [],
			gold: { blue: 0, red: 0 },
			chance: 10000,
			causes: [],
		},
	],
});

describe("M1 · determinism", () => {
	it("the same seed and draft give the same game", () => {
		expect(run(15)).toEqual(run(15));
	});

	it("another seed gives another game", () => {
		expect(run(15).events).not.toEqual(run(15, setup({ seed: 43 })).events);
	});

	it("adding a contest does not shift the draws of the others", () => {
		const extra: Contest = {
			id: 98,
			due: () => true,
			resolve: (_, rng) => {
				rng.next();
				return [];
			},
		};
		expect(run(15, setup(), [extra, ...LANE_CONTESTS]).events).toEqual(
			run(15).events,
		);
	});
});

describe("M2 · minute by minute", () => {
	it("advances one minute at a time and stamps each event with it", () => {
		let state = createMatch(setup());
		for (let minute = 1; minute <= 14; minute++) {
			const next = playMinute(state, LANE_CONTESTS);
			expect(next.state.minute).toBe(minute);
			for (const event of next.events) {
				expect(event.minute).toBe(minute);
				expect(event.second).toBeGreaterThanOrEqual(0);
				expect(event.second).toBeLessThanOrEqual(59);
			}
			const seconds = next.events.map((e) => e.second);
			expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
			state = next.state;
		}
	});

	it("ends only when a nexus falls", () => {
		const { state, events } = playMatch(setup(), [
			...LANE_CONTESTS,
			nexusAt(31),
		]);
		expect(state.minute).toBe(31);
		expect(state.winner).toBe("blue");
		expect(events.at(-1)?.kind).toBe("nexus");
	});

	it("refuses to run forever without a nexus", () => {
		expect(() => playMatch(setup(), LANE_CONTESTS)).toThrow(/nexus/);
	});
});

describe("lanes and jungle", () => {
	const { state, events } = run(20);
	const players = (team: string) =>
		new Set(
			fictionalContent.players.filter((p) => p.team === team).map((p) => p.id),
		);

	it("fights over the three lanes and ganks in the early game only", () => {
		const kinds = new Set(events.map((e) => e.kind));
		expect(kinds).toEqual(new Set(["lane", "gank"]));
		expect(events.filter((e) => e.kind === "lane")).toHaveLength(12);
		expect(events.every((e) => e.minute <= 14)).toBe(true);
	});

	it("places every event in a lane", () => {
		for (const event of events) {
			expect(["lane-top", "lane-mid", "lane-bot"]).toContain(event.zone);
		}
	});

	it("credits kills to the winning side and deaths to the other", () => {
		expect(events.some((e) => e.kills.length > 0)).toBe(true);
		for (const event of events) {
			const [winners, losers] =
				event.side === "blue"
					? [players("forge"), players("shoal")]
					: [players("shoal"), players("forge")];
			for (const kill of event.kills) {
				expect(winners.has(kill.killer)).toBe(true);
				expect(losers.has(kill.victim)).toBe(true);
				for (const id of kill.assists) expect(winners.has(id)).toBe(true);
			}
		}
	});

	it("explains each contest with its causes and chance", () => {
		for (const event of events) {
			expect(event.causes.length).toBeGreaterThan(0);
			expect(event.chance).toBeGreaterThan(0);
			expect(event.chance).toBeLessThan(10000);
		}
	});

	it("keeps gold and kills equal to passive income plus the events", () => {
		const { passive } = fictionalMatchContent.rules.economy;
		for (const side of ["blue", "red"] as const) {
			const fromEvents = events.reduce((sum, e) => sum + e.gold[side], 0);
			// A player down loses the passive income of those seconds (#528).
			const down = deadThrough(
				events,
				state.context.slots,
				farmed(passive),
				state.minute,
			)[side].reduce((sum, gold) => sum + gold, 0);
			expect(state[side].gold).toBe(passive * state.minute + fromEvents - down);
			const kills = events
				.filter((e) => e.side === side)
				.reduce((sum, e) => sum + e.kills.length, 0);
			expect(state[side].kills).toBe(kills);
		}
	});
});

describe("strength decides more often than not", () => {
	const lanes = (value: number): MatchContent => ({
		...fictionalMatchContent,
		players: fictionalMatchContent.players.map((p) =>
			p.id.startsWith("forge-")
				? {
						...p,
						attributes: {
							...p.attributes,
							lanes: value,
							mechanics: value,
							farming: value,
						},
					}
				: p,
		),
	});

	it("better laners win more lane contests over many seeds", () => {
		const share = (value: number) => {
			let won = 0;
			let total = 0;
			for (let seed = 0; seed < 150; seed++) {
				const { events } = run(12, setup({ seed, match: lanes(value) }));
				for (const e of events.filter((x) => x.kind === "lane")) {
					total++;
					if (e.side === "blue") won++;
				}
			}
			return won / total;
		};
		expect(share(99)).toBeGreaterThan(share(30) + 0.1);
	});
});
