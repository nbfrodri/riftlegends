import type { MatchEvent, Side } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { edge } from "./contests/edge";
import { OBJECTIVE_CONTESTS } from "./contests/objectives";
import { takeChance } from "./contests/structures";
import { fictionalMatchContent } from "./fixtures/content";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { createMatch, GRUBS, type MatchState, other } from "./state";

const { rules } = fictionalMatchContent;
const minutes = (seconds: number) =>
	(seconds + 59 - ((seconds + 59) % 60)) / 60;
const games = Array.from({ length: 120 }, (_, seed) =>
	playMatch(matchSetup({ seed }), MATCH_CONTESTS),
);
const grubsOf = (events: readonly MatchEvent[]) =>
	events.filter((e) => e.kind === "grub");

const withGrubs = (
	state: MatchState,
	blue: number,
	red: number,
): MatchState => ({
	...state,
	blue: { ...state.blue, grubs: blue },
	red: { ...state.red, grubs: red },
});

describe("void grubs (#361)", () => {
	it("are one group: a single contest at the pit, three grubs split 3-0 or 2-1", () => {
		const first = minutes(rules.objectives.grub.first);
		const gone = minutes(rules.objectives.grub.despawn);
		let splits = 0;
		for (const { events, state } of games) {
			const grubs = grubsOf(events);
			expect(grubs.length).toBeLessThanOrEqual(1);
			expect(state.blue.grubs + state.red.grubs).toBe(grubs.length * GRUBS);
			for (const e of grubs) {
				const count = e.grubs;
				if (!count) throw new Error("a grub event carries its counts");
				expect(count.blue + count.red).toBe(GRUBS);
				expect(count[e.side]).toBeGreaterThanOrEqual(2);
				expect(count[e.side]).toBeGreaterThan(count[other(e.side)]);
				expect(state[e.side].grubs).toBe(count[e.side]);
				expect(e.minute).toBeGreaterThanOrEqual(first);
				expect(e.minute).toBeLessThan(gone);
				expect(e.zone).toBe("baron-pit");
				for (const side of ["blue", "red"] as const) {
					expect(e.gold[side]).toBe(rules.economy.grub * count[side]);
				}
				if (count[other(e.side)] > 0) splits++;
			}
		}
		expect(games.every(({ events }) => grubsOf(events).length === 1)).toBe(
			true,
		);
		// A small, documented chance: about 15 % of the groups.
		expect(splits).toBeGreaterThan(0);
		expect(splits).toBeLessThan(games.length / 3);
	});

	it("is contested only while the pit is up and the group is untaken", () => {
		const grub = OBJECTIVE_CONTESTS.find((c) => c.id === 14);
		if (!grub) throw new Error("no grub contest");
		const start = createMatch(matchSetup());
		const at = (minute: number, blue = 0, red = 0): MatchState => ({
			...withGrubs(start, blue, red),
			minute,
		});
		expect(grub.due(at(7))).toBe(false);
		expect(grub.due(at(8))).toBe(true);
		expect(grub.due(at(14))).toBe(true);
		expect(grub.due(at(15))).toBe(false);
		// Once the group is taken there is nothing left to contest.
		expect(grub.due(at(9, 3, 0))).toBe(false);
		expect(grub.due(at(9, 1, 2))).toBe(false);
	});

	it("only help the team holding the stacks, and more stacks never hurt", () => {
		const start = { ...createMatch(matchSetup()), minute: 20 };
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: GRUBS }),
				fc.integer({ min: 0, max: GRUBS }),
				fc.integer({ min: 0, max: GRUBS }),
				(a, b, rival) => {
					const [low, high] = a <= b ? [a, b] : [b, a];
					for (const side of ["blue", "red"] as const) {
						const state = (n: number, against = rival) =>
							side === "blue"
								? withGrubs(start, n, against)
								: withGrubs(start, against, n);
						const share = (s: MatchState, who: Side) =>
							who === "blue"
								? edge(s, "siege").blue
								: 10000 - edge(s, "siege").blue;
						// Monotone in own stacks, for the chance to win and to take.
						expect(share(state(high), side)).toBeGreaterThanOrEqual(
							share(state(low), side),
						);
						expect(takeChance(state(high), side)).toBeGreaterThanOrEqual(
							takeChance(state(low), side),
						);
						// The rival's stacks do not change what this side takes.
						expect(takeChance(state(low, 0), side)).toBe(
							takeChance(state(low, GRUBS), side),
						);
					}
				},
			),
		);
	});

	it("raises the take chance only, with the voidmites at three stacks", () => {
		const start = { ...createMatch(matchSetup()), minute: 20 };
		const chance = (n: number) => takeChance(withGrubs(start, n, 0), "blue");
		expect(chance(1)).toBeGreaterThan(chance(0));
		expect(chance(2)).toBeGreaterThan(chance(1));
		// The third grub adds the voidmites on top of its own stack.
		expect(chance(3) - chance(2)).toBeGreaterThan(chance(2) - chance(1));
		// It does not move the siege edge: only the push's take chance changes.
		for (const n of [1, 2, 3]) {
			expect(edge(withGrubs(start, n, 0), "siege").blue).toBe(
				edge(withGrubs(start, 0, 0), "siege").blue,
			);
		}
	});
});
