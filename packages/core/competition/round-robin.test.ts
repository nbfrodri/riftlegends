import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { drawGame1Priority, roundRobin } from "./round-robin";

const teamsOf = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const key = (a: string, b: string) => [a, b].sort().join("|");
const sizeAndRounds = fc.record({
	n: fc.integer({ min: 2, max: 14 }),
	rounds: fc.constantFrom(1 as const, 2 as const),
});

describe("roundRobin", () => {
	test("RR1: every pair meets exactly N times", () => {
		fc.assert(
			fc.property(sizeAndRounds, ({ n, rounds }) => {
				const teams = teamsOf(n);
				const meetings = new Map<string, number>();
				for (const day of roundRobin(teams, rounds)) {
					for (const { a, b } of day.fixtures) {
						meetings.set(key(a, b), (meetings.get(key(a, b)) ?? 0) + 1);
					}
				}
				expect(meetings.size).toBe((n * (n - 1)) / 2);
				expect([...meetings.values()].every((count) => count === rounds)).toBe(
					true,
				);
			}),
		);
	});

	test("RR1: 1 and 2 rounds, the extremes of 2 and 14 teams", () => {
		expect(roundRobin(teamsOf(2), 1)).toHaveLength(1);
		expect(roundRobin(teamsOf(2), 2)).toHaveLength(2);
		const fourteen = roundRobin(teamsOf(14), 2);
		expect(fourteen).toHaveLength(26);
		expect(fourteen.flatMap((day) => day.fixtures)).toHaveLength(182);
	});

	test("RR2: nobody plays twice on the same day", () => {
		fc.assert(
			fc.property(sizeAndRounds, ({ n, rounds }) => {
				for (const day of roundRobin(teamsOf(n), rounds)) {
					const seen = [
						...day.fixtures.flatMap(({ a, b }) => [a, b]),
						...day.byes,
					];
					expect(new Set(seen).size).toBe(seen.length);
					expect(seen.sort()).toEqual(teamsOf(n).sort());
				}
			}),
		);
	});

	test("RR3: with an odd count one team rests each day and all rest the same", () => {
		fc.assert(
			fc.property(
				fc.record({
					n: fc.constantFrom(3, 5, 7, 9, 13),
					rounds: fc.constantFrom(1 as const, 2 as const),
				}),
				({ n, rounds }) => {
					const days = roundRobin(teamsOf(n), rounds);
					expect(days).toHaveLength(n * rounds);
					const rests = new Map<string, number>();
					for (const day of days) {
						expect(day.byes).toHaveLength(1);
						const [bye] = day.byes as [string];
						rests.set(bye, (rests.get(bye) ?? 0) + 1);
					}
					expect(rests.size).toBe(n);
					expect([...rests.values()].every((count) => count === rounds)).toBe(
						true,
					);
				},
			),
		);
	});

	test("RR3: 5 and 7 teams, and no byes with an even count", () => {
		expect(roundRobin(teamsOf(5), 1).map((day) => day.byes.length)).toEqual([
			1, 1, 1, 1, 1,
		]);
		expect(roundRobin(teamsOf(7), 1)).toHaveLength(7);
		expect(
			roundRobin(teamsOf(6), 1).every((day) => day.byes.length === 0),
		).toBe(true);
	});

	test("is deterministic and rejects fewer than two teams or duplicates", () => {
		expect(roundRobin(teamsOf(8), 2)).toEqual(roundRobin(teamsOf(8), 2));
		expect(() => roundRobin(["a"], 1)).toThrow(RangeError);
		expect(() => roundRobin(["a", "a"], 1)).toThrow(RangeError);
	});
});

describe("drawGame1Priority", () => {
	const ids = { competition: 0, season: 0, stage: 1, round: 3 };
	const fixtures = roundRobin(teamsOf(10), 1)[0]?.fixtures ?? [];

	test("RR4: same seed, same draw; the winner is one of the two teams", () => {
		const first = drawGame1Priority(7, ids, fixtures);
		expect(drawGame1Priority(7, ids, fixtures)).toEqual(first);
		first.forEach((priority, index) => {
			const { a, b } = fixtures[index] as (typeof fixtures)[number];
			expect([a, b]).toContain(priority);
		});
	});

	test("RR4: other seeds and other ids give other draws", () => {
		const draws = new Set<string>();
		for (let seed = 0; seed < 8; seed++) {
			draws.add(drawGame1Priority(seed, ids, fixtures).join());
		}
		expect(draws.size).toBeGreaterThan(1);
		expect(drawGame1Priority(7, { ...ids, round: 4 }, fixtures)).not.toEqual(
			drawGame1Priority(7, ids, fixtures),
		);
	});

	test("RR4: a fixture's draw does not depend on the others", () => {
		const all = drawGame1Priority(7, ids, fixtures);
		const one = drawGame1Priority(7, ids, fixtures.slice(0, 1));
		expect(one[0]).toBe(all[0]);
	});

	test("RR4: both sides get priority about half of the time", () => {
		const a = "x";
		const b = "y";
		let aWins = 0;
		for (let seed = 0; seed < 400; seed++) {
			if (drawGame1Priority(seed, ids, [{ a, b }])[0] === a) aWins++;
		}
		expect(aWins).toBeGreaterThan(140);
		expect(aWins).toBeLessThan(260);
	});

	test("RR4: pinned draw for a seed", () => {
		expect(drawGame1Priority(2, ids, fixtures)).toMatchInlineSnapshot(`
			[
			  "t1",
			  "t9",
			  "t3",
			  "t7",
			  "t5",
			]
		`);
	});
});
