import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SCOPES } from "./scopes";
import { deriveSeed } from "./seeds";

const MAX = 0xffffffff;

// Independent reference: FNV-1a 32 over little-endian uint32 words, with BigInt.
function reference(words: number[]) {
	let hash = 2166136261n;
	for (const word of words) {
		for (let shift = 0; shift < 32; shift += 8) {
			hash =
				((hash ^ BigInt((word >>> shift) & 255)) * 16777619n) & 0xffffffffn;
		}
	}
	return Number(hash);
}

describe("deriveSeed", () => {
	test("G1: matches the S3 vectors", () => {
		expect(deriveSeed(2, SCOPES.draft, 75, 1)).toBe(2489897068);
		expect(deriveSeed(2, SCOPES.match, 75, 1)).toBe(469212319);
	});

	test("G1: handles the uint32 extremes", () => {
		for (const edge of [0, MAX]) {
			expect(deriveSeed(edge, SCOPES.draft, edge, edge)).toBe(
				reference([edge, SCOPES.draft, edge, edge]),
			);
		}
	});

	test("G1: a different number of ids gives another seed", () => {
		const seeds = [
			deriveSeed(2, SCOPES.draft),
			deriveSeed(2, SCOPES.draft, 0),
			deriveSeed(2, SCOPES.draft, 0, 0),
		];
		expect(new Set(seeds).size).toBe(3);
	});

	test("G1: matches the reference for any input and returns a uint32", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: MAX }),
				fc.constantFrom(...Object.values(SCOPES)),
				fc.array(fc.integer({ min: 0, max: MAX }), { maxLength: 5 }),
				(root, scope, ids) => {
					const seed = deriveSeed(root, scope, ...ids);
					expect(seed).toBe(reference([root, scope, ...ids]));
					expect(Number.isInteger(seed) && seed >= 0 && seed <= MAX).toBe(true);
				},
			),
		);
	});

	test.each([-1, 1.5, Number.NaN, MAX + 1, Number.POSITIVE_INFINITY])(
		"G2: rejects %s in any position",
		(bad) => {
			expect(() => deriveSeed(bad, SCOPES.draft, 1)).toThrow(RangeError);
			expect(() => deriveSeed(1, bad, 1)).toThrow(RangeError);
			expect(() => deriveSeed(1, SCOPES.draft, bad)).toThrow(RangeError);
			expect(() => deriveSeed(1, SCOPES.draft, 1, bad)).toThrow(RangeError);
		},
	);
});

describe("SCOPES", () => {
	test("G7: numbers are unique and positive integers", () => {
		const numbers = Object.values(SCOPES);
		expect(new Set(numbers).size).toBe(numbers.length);
		for (const n of numbers) {
			expect(Number.isInteger(n) && n > 0 && n <= MAX).toBe(true);
		}
	});

	test("G7: existing numbers are stable", () => {
		expect(SCOPES).toEqual({
			draft: 1,
			match: 2,
			ai: 3,
			side: 4,
			matchAttribution: 5,
			competition: 6,
		});
	});
});
