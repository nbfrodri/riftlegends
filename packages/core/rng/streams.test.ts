import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { int, pick, shuffle, weighted } from "./helpers";
import { createRng, restoreRng, rngState } from "./streams";

const MAX = 0xffffffff;

const bump = (counts: number[], index: number) => {
	counts[index] = (counts[index] ?? 0) + 1;
};
const distance = (a: number, b: number) => (a > b ? a - b : b - a);
const seed = fc.integer({ min: 0, max: MAX });

function take(rng: ReturnType<typeof createRng>, count: number) {
	return Array.from({ length: count }, () => int(rng, 0, MAX));
}

describe("streams", () => {
	test("same seed gives the same sequence, another seed does not", () => {
		expect(take(createRng(7), 10)).toEqual(take(createRng(7), 10));
		expect(take(createRng(7), 10)).not.toEqual(take(createRng(8), 10));
	});

	test("state has four int32 words and matches the S3 snapshot", () => {
		// S3: draft stream of seed 2, series 75, game 1 starts from this state.
		expect(rngState(createRng(2489897068))).toEqual([
			-1, 1805070227, -1805070228, 0,
		]);
	});

	test("G3: a restored stream continues with the same sequence", () => {
		fc.assert(
			fc.property(seed, fc.integer({ min: 0, max: 1000 }), (s, cut) => {
				const original = createRng(s);
				take(original, cut);
				const restored = restoreRng(rngState(original));
				expect(take(restored, 100)).toEqual(take(original, 100));
			}),
			{ numRuns: 50 },
		);
	});

	test("the state survives a JSON round trip", () => {
		const rng = createRng(5);
		take(rng, 3);
		const state = JSON.parse(JSON.stringify(rngState(rng)));
		expect(take(restoreRng(state), 5)).toEqual(take(rng, 5));
	});

	test.each([
		[[1, 2, 3]],
		[[1, 2, 3, 4, 5]],
		[[1, 2, 3, 1.5]],
		[[1, 2, 3, 2 ** 31]],
	])("rejects the invalid state %j", (state) => {
		expect(() => restoreRng(state as never)).toThrow(RangeError);
	});

	test("restoring does not alias the given state", () => {
		const state = [...rngState(createRng(1))] as [
			number,
			number,
			number,
			number,
		];
		const rng = restoreRng(state);
		take(rng, 5);
		expect(state).toEqual(rngState(createRng(1)));
	});
});

describe("int", () => {
	test("G4: stays within [min, max]", () => {
		fc.assert(
			fc.property(
				seed,
				fc.integer({ min: -1000, max: 1000 }),
				fc.integer({ min: 0, max: 1000 }),
				(s, min, span) => {
					const rng = createRng(s);
					for (let i = 0; i < 20; i++) {
						const value = int(rng, min, min + span);
						expect(value).toBeGreaterThanOrEqual(min);
						expect(value).toBeLessThanOrEqual(min + span);
					}
				},
			),
		);
	});

	test("G4: a single-value range returns it without consuming the stream", () => {
		const rng = createRng(3);
		const before = rngState(rng);
		expect(int(rng, 9, 9)).toBe(9);
		expect(rngState(rng)).toEqual(before);
	});

	test("G4: covers the full 32-bit range", () => {
		const rng = createRng(11);
		const values = take(rng, 200);
		expect(values.every((value) => value >= 0 && value <= MAX)).toBe(true);
		expect(values.some((value) => value > 2 ** 31)).toBe(true);
		expect(values.some((value) => value < 2 ** 31)).toBe(true);
	});

	test("G4: rejects min > max and non-integer or unsafe bounds", () => {
		const rng = createRng(1);
		expect(() => int(rng, 2, 1)).toThrow(RangeError);
		expect(() => int(rng, 0.5, 3)).toThrow(RangeError);
		expect(() => int(rng, 0, Number.NaN)).toThrow(RangeError);
		expect(() => int(rng, 0, 2 ** 53)).toThrow(RangeError);
	});

	test("G4: is uniform", () => {
		const draws = 60_000;
		const counts = new Array<number>(6).fill(0);
		const rng = createRng(42);
		for (let i = 0; i < draws; i++) {
			bump(counts, int(rng, 0, 5));
		}
		for (const count of counts) {
			expect(distance(count / draws, 1 / 6)).toBeLessThan(0.01);
		}
	});
});

describe("pick and shuffle", () => {
	test("G5: pick is deterministic and returns an element", () => {
		const items = ["a", "b", "c", "d"];
		expect(pick(createRng(4), items)).toBe(pick(createRng(4), items));
		fc.assert(
			fc.property(seed, fc.array(fc.integer(), { minLength: 1 }), (s, list) => {
				expect(list).toContain(pick(createRng(s), list));
			}),
		);
	});

	test("G5: pick of one item returns it; empty list throws", () => {
		expect(pick(createRng(1), ["only"])).toBe("only");
		expect(() => pick(createRng(1), [])).toThrow(RangeError);
	});

	test("G5: shuffle is a deterministic permutation and does not mutate", () => {
		fc.assert(
			fc.property(seed, fc.array(fc.integer()), (s, list) => {
				const copy = [...list];
				const result = shuffle(createRng(s), list);
				expect(list).toEqual(copy);
				expect(result).not.toBe(list);
				expect([...result].sort((a, b) => a - b)).toEqual(
					[...list].sort((a, b) => a - b),
				);
				expect(shuffle(createRng(s), list)).toEqual(result);
			}),
		);
	});

	test("G5: shuffle of an empty or one-item list", () => {
		expect(shuffle(createRng(1), [])).toEqual([]);
		expect(shuffle(createRng(1), [5])).toEqual([5]);
	});

	test("G5: shuffle reaches every permutation of three items", () => {
		const rng = createRng(9);
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) {
			seen.add(shuffle(rng, [1, 2, 3]).join());
		}
		expect(seen.size).toBe(6);
	});
});

describe("weighted", () => {
	test("G6: weight 0 never comes out", () => {
		const rng = createRng(6);
		for (let i = 0; i < 2000; i++) {
			expect(weighted(rng, [0, 3, 0, 1])).not.toBe(0);
		}
		const again = createRng(6);
		for (let i = 0; i < 2000; i++) {
			expect(weighted(again, [0, 3, 0, 1])).not.toBe(2);
		}
	});

	test("G6: a single positive weight always wins", () => {
		const rng = createRng(2);
		for (let i = 0; i < 100; i++) {
			expect(weighted(rng, [0, 0, 5])).toBe(2);
		}
	});

	test("G6: rejects empty, all-zero, negative and non-integer weights", () => {
		const rng = createRng(1);
		expect(() => weighted(rng, [])).toThrow(RangeError);
		expect(() => weighted(rng, [0, 0])).toThrow(RangeError);
		expect(() => weighted(rng, [1, -1])).toThrow(RangeError);
		expect(() => weighted(rng, [1, 0.5])).toThrow(RangeError);
		expect(() => weighted(rng, [1, Number.NaN])).toThrow(RangeError);
	});

	test("G6: frequencies follow the weights", () => {
		fc.assert(
			fc.property(
				seed,
				fc
					.array(fc.integer({ min: 0, max: 20 }), {
						minLength: 1,
						maxLength: 6,
					})
					.filter((weights) => weights.some((w) => w > 0)),
				(s, weights) => {
					const rng = createRng(s);
					const draws = 100_000;
					const total = weights.reduce((a, b) => a + b, 0);
					const counts = weights.map(() => 0);
					for (let i = 0; i < draws; i++) {
						bump(counts, weighted(rng, weights));
					}
					weights.forEach((w, index) => {
						expect(
							distance((counts[index] ?? 0) / draws, w / total),
						).toBeLessThan(0.01);
					});
				},
			),
			{ numRuns: 10 },
		);
	});
});
