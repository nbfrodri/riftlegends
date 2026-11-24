import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { goldLead, usefulGold } from "./gold";

const rules = {
	fullBuildGold: 17_000,
	goldOverflow: 1000,
	goldLeadPoints: 3_400_000,
	goldMaxPoints: 250_000,
};
const five = (gold: number) => [gold, gold, gold, gold, gold];
const golds = fc.array(fc.integer({ min: 0, max: 40_000 }), {
	minLength: 5,
	maxLength: 5,
});

describe("G2 · relative gold lead", () => {
	it("is zero with equal gold or no gold", () => {
		expect(goldLead(five(9000), five(9000), rules)).toBe(0);
		expect(goldLead(five(0), five(0), rules)).toBe(0);
	});

	it("is antisymmetric and bounded by the cap", () => {
		fc.assert(
			fc.property(golds, golds, (a, b) => {
				const lead = goldLead(a, b, rules);
				expect(goldLead(b, a, rules)).toBe(-lead);
				expect(Math.abs(lead)).toBeLessThanOrEqual(rules.goldMaxPoints);
			}),
		);
	});

	it("grows with the gold of the leader", () => {
		fc.assert(
			fc.property(
				golds,
				golds,
				fc.integer({ min: 0, max: 4 }),
				fc.integer({ min: 1, max: 5000 }),
				(a, b, i, more) => {
					const richer = a.map((g, j) => (j === i ? g + more : g));
					expect(goldLead(richer, b, rules)).toBeGreaterThanOrEqual(
						goldLead(a, b, rules),
					);
				},
			),
		);
	});

	it("weighs the same absolute gap more with less total gold", () => {
		const early = goldLead(
			[5000, 0, 0, 0, 0].map((g) => g + 4000),
			five(4000),
			rules,
		);
		const late = goldLead(
			[5000, 0, 0, 0, 0].map((g) => g + 12_000),
			five(12_000),
			rules,
		);
		expect(early).toBeGreaterThan(late);
		expect(late).toBeGreaterThan(0);
	});

	it("matches the hand calculation of K4: 3,000 over about 102,000", () => {
		// 3,000 / 102,000 = 294 fixed; 294 * 340 = 99,960 points.
		expect(goldLead(five(10_500), five(9900), rules)).toBe(99_960);
	});

	it("caps one player holding all the gold", () => {
		expect(goldLead([40_000, 0, 0, 0, 0], five(0), rules)).toBe(
			rules.goldMaxPoints,
		);
	});

	it("rounds half to even", () => {
		// A lead of 2 over a total of 8 is 2,500 fixed.
		const lead = (goldLeadPoints: number) =>
			goldLead([5, 0, 0, 0, 0], [3, 0, 0, 0, 0], { ...rules, goldLeadPoints });
		expect(lead(2)).toBe(0); // 0.5
		expect(lead(6)).toBe(2); // 1.5
		expect(lead(10)).toBe(2); // 2.5
	});
});

describe("G3 · saturation at the full build", () => {
	it("counts gold up to the full build in full and the rest at the overflow", () => {
		expect(usefulGold(17_000, rules)).toBe(17_000);
		expect(usefulGold(17_001, rules)).toBe(17_000);
		expect(usefulGold(18_000, rules)).toBe(17_100);
		expect(usefulGold(0, rules)).toBe(0);
	});

	it("the same gap moves the lead less once the leader is saturated", () => {
		const open = goldLead(five(12_000), five(9000), rules);
		const full = goldLead(five(20_000), five(17_000), rules);
		expect(full).toBeLessThan(open);
	});

	it("barely changes when every player is above the full build", () => {
		const lead = goldLead(five(30_000), five(25_000), rules);
		expect(lead).toBeLessThan(60_000);
		expect(lead).toBeGreaterThanOrEqual(0);
	});

	it("one player just over the threshold adds almost nothing", () => {
		const at = goldLead([17_000, 9000, 9000, 9000, 9000], five(9000), rules);
		const over = goldLead([17_001, 9000, 9000, 9000, 9000], five(9000), rules);
		expect(over - at).toBeLessThanOrEqual(1);
	});

	it("a lower full build saturates the same gap earlier", () => {
		const roomy = goldLead(five(11_000), five(10_000), rules);
		const tight = goldLead(five(11_000), five(10_000), {
			...rules,
			fullBuildGold: 10_000,
		});
		expect(tight).toBeLessThan(roomy);
	});

	it("follows a changed threshold and overflow", () => {
		expect(usefulGold(20_000, { ...rules, fullBuildGold: 10_000 })).toBe(
			11_000,
		);
		expect(usefulGold(20_000, { ...rules, goldOverflow: 0 })).toBe(17_000);
		expect(usefulGold(20_000, { ...rules, goldOverflow: 10_000 })).toBe(20_000);
	});

	it("the carry saturates before the rest", () => {
		const unequal = goldLead(
			[30_000, 8000, 8000, 8000, 8000],
			five(10_000),
			rules,
		);
		const flat = goldLead(five(12_400), five(10_000), rules);
		expect(unequal).toBeLessThan(flat);
	});
});
