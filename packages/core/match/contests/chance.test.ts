import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SCALE } from "../../math";
import { chance, SPREAD } from "./chance";

describe("chance", () => {
	it("is even with no edge", () => {
		expect(chance(0)).toBe(5000);
	});

	it("is symmetric, integer, bounded and never certain", () => {
		fc.assert(
			fc.property(fc.integer({ min: -1e9, max: 1e9 }), (edge) => {
				const p = chance(edge);
				expect(Number.isSafeInteger(p)).toBe(true);
				expect(p + chance(-edge)).toBe(10000);
				expect(p).toBeGreaterThan(0);
				expect(p).toBeLessThan(10000);
			}),
		);
	});

	it("grows with the edge", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: -1e8, max: 1e8 }),
				fc.integer({ min: 1, max: 1e6 }),
				(edge, more) => {
					expect(chance(edge + more)).toBeGreaterThanOrEqual(chance(edge));
				},
			),
		);
	});

	it("follows the logistic curve: one spread of edge is about 73 %", () => {
		expect(chance(SPREAD)).toBe(7311);
		expect(chance(SPREAD / 2)).toBe(6225);
		expect(chance(-SPREAD)).toBe(2689);
		expect(SPREAD % (4 * SCALE)).toBe(0);
	});
});
