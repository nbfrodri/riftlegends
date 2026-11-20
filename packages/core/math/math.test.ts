import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { add, div, type Fixed, fromInt, mul, SCALE, sub, toInt } from "./fixed";
import { abs, clamp, max, min } from "./int";

const MAX = Number.MAX_SAFE_INTEGER;
const fx = (n: number) => n as Fixed;
const safeInt = fc.integer({ min: -MAX, max: MAX });
const mid = fc.integer({ min: -1_000_000_000, max: 1_000_000_000 });

describe("A1 fixed point", () => {
	test("uses scale 10000", () => {
		expect(SCALE).toBe(10_000);
		expect(fromInt(3)).toBe(30_000);
		expect(toInt(fx(30_000))).toBe(3);
	});

	test("add and sub are exact", () => {
		fc.assert(
			fc.property(mid, mid, (a, b) => {
				expect(add(fx(a), fx(b))).toBe(a + b);
				expect(sub(fx(a), fx(b))).toBe(a - b);
			}),
		);
	});

	test("mul rounds half to even", () => {
		// 0.0001 * 0.5 = 0.00005: tie between 0 and 1, so 0
		expect(mul(fx(1), fx(5_000))).toBe(0);
		// 0.0003 * 0.5 = 0.00015: tie between 1 and 2, so 2
		expect(mul(fx(3), fx(5_000))).toBe(2);
		expect(mul(fx(5), fx(5_000))).toBe(2);
		expect(mul(fx(7), fx(5_000))).toBe(4);
		// Not ties
		expect(mul(fx(1), fx(4_999))).toBe(0);
		expect(mul(fx(1), fx(5_001))).toBe(1);
	});

	test("mul rounds negatives half to even, symmetric around zero", () => {
		expect(mul(fx(-1), fx(5_000))).toBe(0);
		expect(mul(fx(-3), fx(5_000))).toBe(-2);
		expect(mul(fx(3), fx(-5_000))).toBe(-2);
		expect(mul(fx(-3), fx(-5_000))).toBe(2);
		expect(mul(fx(-1), fx(5_001))).toBe(-1);
	});

	test("div rounds half to even", () => {
		expect(div(fx(1), fromInt(2))).toBe(0);
		expect(div(fx(3), fromInt(2))).toBe(2);
		expect(div(fx(5), fromInt(2))).toBe(2);
		expect(div(fx(-3), fromInt(2))).toBe(-2);
		expect(div(fx(3), fromInt(-2))).toBe(-2);
		expect(div(fx(-3), fromInt(-2))).toBe(2);
		expect(div(fromInt(1), fromInt(3))).toBe(3_333);
		expect(div(fromInt(2), fromInt(3))).toBe(6_667);
	});

	test("mul and div by one are identities", () => {
		fc.assert(
			fc.property(safeInt, (a) => {
				expect(mul(fx(a), fromInt(1))).toBe(a);
				expect(div(fx(a), fromInt(1))).toBe(a);
			}),
		);
	});

	test("mul is within half a unit of the exact product", () => {
		fc.assert(
			fc.property(mid, mid, (a, b) => {
				const r = mul(fx(a), fx(b));
				const error = BigInt(a) * BigInt(b) - BigInt(r) * 10_000n;
				const magnitude = error < 0n ? -error : error;
				expect(magnitude <= 5_000n).toBe(true);
			}),
		);
	});

	test("div is within half a unit of the exact quotient", () => {
		fc.assert(
			fc.property(
				mid,
				mid.filter((b) => b !== 0),
				(a, b) => {
					const r = div(fx(a), fx(b));
					const error = 2n * (BigInt(a) * 10_000n - BigInt(r) * BigInt(b));
					const bound = BigInt(b) < 0n ? -BigInt(b) : BigInt(b);
					const magnitude = error < 0n ? -error : error;
					expect(magnitude <= bound).toBe(true);
				},
			),
		);
	});

	test("div by zero throws", () => {
		expect(() => div(fromInt(1), fx(0))).toThrow(RangeError);
	});

	test("overflow beyond MAX_SAFE_INTEGER throws instead of losing precision", () => {
		expect(() => add(fx(MAX), fx(1))).toThrow(RangeError);
		expect(() => sub(fx(-MAX), fx(1))).toThrow(RangeError);
		expect(() => mul(fx(MAX), fromInt(2))).toThrow(RangeError);
		expect(() => div(fx(MAX), fx(1))).toThrow(RangeError);
		expect(() => fromInt(MAX)).toThrow(RangeError);
		expect(add(fx(MAX - 1), fx(1))).toBe(MAX);
		// The intermediate product exceeds 2^53 but the result fits
		expect(mul(fx(MAX), fromInt(1))).toBe(MAX);
	});

	test("rejects non-safe-integer inputs", () => {
		expect(() => add(fx(0.5), fx(1))).toThrow(RangeError);
		expect(() => mul(fx(Number.NaN), fx(1))).toThrow(RangeError);
		expect(() => fromInt(1.5)).toThrow(RangeError);
	});

	test("toInt rounds half to even", () => {
		expect(toInt(fx(5_000))).toBe(0);
		expect(toInt(fx(15_000))).toBe(2);
		expect(toInt(fx(25_000))).toBe(2);
		expect(toInt(fx(-5_000))).toBe(0);
		expect(toInt(fx(-15_000))).toBe(-2);
		expect(toInt(fx(4_999))).toBe(0);
		expect(toInt(fx(-5_001))).toBe(-1);
	});
});

describe("A2 integer helpers", () => {
	test("min and max", () => {
		expect(min(2, 3)).toBe(2);
		expect(max(2, 3)).toBe(3);
		expect(min(-2, -3)).toBe(-3);
		expect(max(-2, -3)).toBe(-2);
		expect(min(-MAX, MAX)).toBe(-MAX);
		expect(max(-MAX, MAX)).toBe(MAX);
	});

	test("abs", () => {
		expect(abs(-5)).toBe(5);
		expect(abs(5)).toBe(5);
		expect(Object.is(abs(0), 0)).toBe(true);
		expect(Object.is(abs(-0), 0)).toBe(true);
		expect(abs(-MAX)).toBe(MAX);
	});

	test("clamp is inclusive and handles negative limits", () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
		expect(clamp(0, 0, 10)).toBe(0);
		expect(clamp(10, 0, 10)).toBe(10);
		expect(clamp(-7, -10, -5)).toBe(-7);
		expect(clamp(-20, -10, -5)).toBe(-10);
		expect(clamp(0, -10, -5)).toBe(-5);
		expect(clamp(3, 3, 3)).toBe(3);
	});

	test("clamp rejects an inverted range", () => {
		expect(() => clamp(1, 10, 0)).toThrow(RangeError);
	});

	test("properties", () => {
		fc.assert(
			fc.property(safeInt, safeInt, safeInt, (x, a, b) => {
				const lo = min(a, b);
				const hi = max(a, b);
				const c = clamp(x, lo, hi);
				expect(c).toBeGreaterThanOrEqual(lo);
				expect(c).toBeLessThanOrEqual(hi);
				expect(clamp(c, lo, hi)).toBe(c);
				expect(abs(x)).toBeGreaterThanOrEqual(0);
				expect(abs(abs(x))).toBe(abs(x));
			}),
		);
	});

	test("rejects non-safe-integer inputs", () => {
		expect(() => abs(1.5)).toThrow(RangeError);
		expect(() => min(1, Number.NaN)).toThrow(RangeError);
		expect(() => clamp(Number.POSITIVE_INFINITY, 0, 1)).toThrow(RangeError);
	});
});
