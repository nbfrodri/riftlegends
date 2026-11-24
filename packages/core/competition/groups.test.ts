import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { max, min } from "../math/int";
import {
	assignGroups,
	crossGroupSchedule,
	type GroupTeam,
	groupSchedule,
} from "./groups";

const seeds = (n: number, region?: (i: number) => string): GroupTeam[] =>
	Array.from({ length: n }, (_, i) => ({
		id: `s${i + 1}`,
		...(region ? { region: region(i) } : {}),
	}));

describe("assignGroups", () => {
	test("G1: 10 teams in 2 groups follow the snake", () => {
		expect(assignGroups(seeds(10), { count: 2 })).toEqual([
			["s1", "s4", "s5", "s8", "s9"],
			["s2", "s3", "s6", "s7", "s10"],
		]);
	});

	test("G1: 14 teams in groups of 8 and 6 keep the snake until one fills", () => {
		const [big, small] = assignGroups(seeds(14), { count: 2, sizes: [8, 6] });
		expect(big).toEqual(["s1", "s4", "s5", "s8", "s9", "s12", "s13", "s14"]);
		expect(small).toEqual(["s2", "s3", "s6", "s7", "s10", "s11"]);
	});

	test("G1: sizes differ by at most one and every team lands once", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 2, max: 32 }).chain((n) =>
					fc.record({
						n: fc.constant(n),
						count: fc.integer({ min: 1, max: min(8, n) }),
					}),
				),
				({ n, count }) => {
					const groups = assignGroups(seeds(n), { count });
					expect(groups).toHaveLength(count);
					const sizes = groups.map((group) => group.length);
					expect(sizes.reduce(max) - sizes.reduce(min)).toBeLessThanOrEqual(1);
					expect(groups.flat().sort()).toEqual(
						seeds(n)
							.map((t) => t.id)
							.sort(),
					);
				},
			),
		);
	});

	test("G1: each group takes one team per pot (never two of the best four in 4 groups)", () => {
		const groups = assignGroups(seeds(16), { count: 4 });
		for (const group of groups) {
			const pots = group.map(
				(id) => (Number(id.slice(1)) - 1 - ((Number(id.slice(1)) - 1) % 4)) / 4,
			);
			expect(new Set(pots).size).toBe(4);
		}
	});

	test("G2: same-region teams are split when there is an alternative", () => {
		const region = (i: number) => (i % 2 === 0 ? "EU" : "NA");
		const groups = assignGroups(seeds(8, region), { count: 2 });
		for (const group of groups) {
			const regions = group.map((id) => region(Number(id.slice(1)) - 1));
			expect(regions.filter((r) => r === "EU")).toHaveLength(2);
		}
		const lpl = (i: number) => (i < 2 ? "CN" : `r${i}`);
		for (const group of assignGroups(seeds(8, lpl), { count: 2 })) {
			expect(group.filter((id) => Number(id.slice(1)) <= 2)).toHaveLength(1);
		}
	});

	test("G2: a region with more teams than groups spreads as little as possible", () => {
		const region = (i: number) => (i < 5 ? "KR" : `r${i}`);
		const groups = assignGroups(seeds(12, region), { count: 3 });
		const krPerGroup = groups.map(
			(group) => group.filter((id) => Number(id.slice(1)) <= 5).length,
		);
		expect(krPerGroup.reduce(max) - krPerGroup.reduce(min)).toBeLessThanOrEqual(
			1,
		);
	});

	test("G2: never more same-region pairs than the plain snake", () => {
		const pairs = (groups: string[][], regionOf: (id: string) => string) =>
			groups.reduce((total, group) => {
				const counts = new Map<string, number>();
				for (const id of group) {
					counts.set(regionOf(id), (counts.get(regionOf(id)) ?? 0) + 1);
				}
				return (
					total +
					[...counts.values()].reduce((sum, c) => sum + (c * (c - 1)) / 2, 0)
				);
			}, 0);
		fc.assert(
			fc.property(
				fc.integer({ min: 2, max: 4 }),
				fc.array(fc.integer({ min: 0, max: 3 }), {
					minLength: 4,
					maxLength: 24,
				}),
				(count, regionIndexes) => {
					fc.pre(regionIndexes.length >= count);
					const teams = regionIndexes.map((r, i) => ({
						id: `s${i + 1}`,
						region: `r${r}`,
					}));
					const regionOf = (id: string) =>
						teams.find((t) => t.id === id)?.region ?? "";
					const plain = assignGroups(
						teams.map(({ id }) => ({ id })),
						{ count },
					);
					const separated = assignGroups(teams, { count });
					expect(pairs(separated, regionOf)).toBeLessThanOrEqual(
						pairs(plain, regionOf),
					);
				},
			),
		);
	});

	test("rejects bad input", () => {
		expect(() => assignGroups(seeds(4), { count: 0 })).toThrow(RangeError);
		expect(() => assignGroups(seeds(4), { count: 5 })).toThrow(RangeError);
		expect(() => assignGroups(seeds(4), { count: 2, sizes: [3, 3] })).toThrow(
			RangeError,
		);
		expect(() =>
			assignGroups([{ id: "a" }, { id: "a" }], { count: 1 }),
		).toThrow(RangeError);
	});
});

const groupOf = (groups: string[][]) => (id: string) =>
	groups.findIndex((group) => group.includes(id));

describe("group schedules", () => {
	const groups = assignGroups(seeds(10), { count: 2 });

	test("inner groups play a round robin among themselves", () => {
		const days = groupSchedule(groups, 2);
		const meetings = new Map<string, number>();
		for (const day of days) {
			const seen = day.fixtures.flatMap(({ a, b }) => [a, b]);
			expect(new Set(seen).size).toBe(seen.length);
			for (const { a, b } of day.fixtures) {
				expect(groupOf(groups)(a)).toBe(groupOf(groups)(b));
				const k = [a, b].sort().join("|");
				meetings.set(k, (meetings.get(k) ?? 0) + 1);
			}
		}
		expect(meetings.size).toBe(20);
		expect([...meetings.values()].every((c) => c === 2)).toBe(true);
	});

	test("G3: a crossed group stage only plays the other group", () => {
		const days = crossGroupSchedule(groups, 1);
		const played = new Map<string, Set<string>>();
		let series = 0;
		for (const day of days) {
			const seen = day.fixtures.flatMap(({ a, b }) => [a, b]);
			expect(new Set(seen).size).toBe(seen.length);
			for (const { a, b } of day.fixtures) {
				series++;
				expect(groupOf(groups)(a)).not.toBe(groupOf(groups)(b));
				played.set(a, (played.get(a) ?? new Set()).add(b));
				played.set(b, (played.get(b) ?? new Set()).add(a));
			}
		}
		expect(series).toBe(25);
		for (const [team, rivals] of played) {
			expect(rivals.size).toBe(5);
			expect(
				[...rivals].every((r) => groupOf(groups)(r) !== groupOf(groups)(team)),
			).toBe(true);
		}
	});

	test("G3: with 3 groups and 2 rounds every cross pair meets twice", () => {
		const three = assignGroups(seeds(9), { count: 3 });
		const meetings = new Map<string, number>();
		for (const day of crossGroupSchedule(three, 2)) {
			for (const { a, b } of day.fixtures) {
				const k = [a, b].sort().join("|");
				meetings.set(k, (meetings.get(k) ?? 0) + 1);
			}
		}
		expect(meetings.size).toBe(27);
		expect([...meetings.values()].every((c) => c === 2)).toBe(true);
	});
});
