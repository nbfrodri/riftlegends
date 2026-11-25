import { ROLES, type Role } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { abs } from "../math";
import { ANCHORS, type Metric, per30, rate, share, WEIGHTS } from "./rating";

// R3 of plan 08 (#348): a common 0–100 rating where 60 is the role reference.

type Values = Partial<Record<Metric, number | null>>;

const metricsOf = (role: Role) => Object.keys(WEIGHTS[role]) as Metric[];

/** The value of a metric that scores `score`, by the anchors of the role. */
const valueFor = (role: Role, metric: Metric, score: number) => {
	const { low, mid, high } = ANCHORS[role][metric] as {
		low: number;
		mid: number;
		high: number;
	};
	const value =
		score <= 60
			? low + ((mid - low) * score) / 60
			: mid + ((high - mid) * (score - 60)) / 40;
	return Number(value.toFixed(0));
};

const performance = (role: Role, score: number): Values =>
	Object.fromEntries(metricsOf(role).map((m) => [m, valueFor(role, m, score)]));

describe("R3 · common rating scale", () => {
	it("the weights of every role add up to 100", () => {
		for (const role of ROLES) {
			const total = Object.values(WEIGHTS[role]).reduce((a, b) => a + b, 0);
			expect(total, role).toBe(100);
		}
	});

	it("uses the approved weights of each role", () => {
		expect(WEIGHTS.top).toEqual({ damage: 40, pressure: 35, deaths: 25 });
		expect(WEIGHTS.jungle).toEqual({ kp: 45, objectives: 35, deaths: 20 });
		expect(WEIGHTS.mid).toEqual({ damage: 45, kills: 30, deaths: 25 });
		expect(WEIGHTS.bot).toEqual({ damage: 45, kills: 30, deaths: 25 });
		expect(WEIGHTS.support).toEqual({
			kp: 35,
			assists: 25,
			deaths: 20,
			vision: 20,
		});
	});

	it("the reference performance of a role is 60", () => {
		for (const role of ROLES) {
			expect(rate(role, performance(role, 60)).rating, role).toBe(60);
		}
	});

	it("the P10 performance is 0 and the P90 performance is 100", () => {
		for (const role of ROLES) {
			expect(rate(role, performance(role, 0)).rating, role).toBe(0);
			expect(rate(role, performance(role, 100)).rating, role).toBe(100);
		}
	});

	it("values beyond the anchors are clamped to 0 and 100", () => {
		for (const role of ROLES) {
			const extreme = (sign: 1 | -1): Values =>
				Object.fromEntries(
					metricsOf(role).map((m) => {
						const { low, high } = ANCHORS[role][m] as {
							low: number;
							high: number;
						};
						const towards = sign === 1 ? high : low;
						return [m, towards + (high - low) * sign * 10];
					}),
				);
			expect(rate(role, extreme(1)).rating).toBe(100);
			expect(rate(role, extreme(-1)).rating).toBe(0);
		}
	});

	it("without opportunities a metric contributes the neutral 60", () => {
		for (const role of ROLES) {
			const none = Object.fromEntries(metricsOf(role).map((m) => [m, null]));
			expect(rate(role, none).rating, role).toBe(60);
			expect(rate(role, {}).rating, role).toBe(60);
		}
	});

	it("a metric with no opportunities does not drag the others", () => {
		const values = { ...performance("support", 100), vision: null };
		// Vision weighs 20 and counts 60, so 80 · 100 + 20 · 60 = 92.
		expect(rate("support", values).rating).toBe(92);
	});

	it("the same performance relative to the role gives the same rating in every role", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
				for (const role of ROLES) {
					const got = rate(role, performance(role, score)).rating;
					expect(abs(got - score), `${role} @ ${score}`).toBeLessThanOrEqual(1);
				}
			}),
		);
	});

	it("more deaths never improve the rating, and fewer never worsen it", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...ROLES),
				fc.integer({ min: 0, max: 100 }),
				fc.integer({ min: 0, max: 2000 }),
				fc.integer({ min: 1, max: 2000 }),
				(role, score, deaths, more) => {
					const base = performance(role, score);
					const fewer = rate(role, { ...base, deaths }).rating;
					const worse = rate(role, { ...base, deaths: deaths + more }).rating;
					expect(worse).toBeLessThanOrEqual(fewer);
				},
			),
		);
	});

	it("the rating is an integer from 0 to 100 for any values", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...ROLES),
				fc.dictionary(
					fc.constantFrom<Metric>(
						"damage",
						"kills",
						"kp",
						"assists",
						"deaths",
						"pressure",
						"objectives",
						"vision",
					),
					fc.integer({ min: -100_000, max: 100_000 }),
				),
				(role, values) => {
					const { rating } = rate(role, values);
					expect(Number.isInteger(rating)).toBe(true);
					expect(rating).toBeGreaterThanOrEqual(0);
					expect(rating).toBeLessThanOrEqual(100);
				},
			),
		);
	});

	it("objectives and pressure only count for the roles that weigh them", () => {
		const base = performance("jungle", 60);
		expect(
			rate("jungle", { ...base, objectives: 10_000 }).rating,
		).toBeGreaterThan(60);
		expect(
			rate("mid", { ...performance("mid", 60), objectives: 10_000 }).rating,
		).toBe(60);
		expect(
			rate("top", { ...performance("top", 60), pressure: 10_000 }).rating,
		).toBeGreaterThan(60);
		expect(
			rate("bot", { ...performance("bot", 60), pressure: 10_000 }).rating,
		).toBe(60);
	});

	it("a support with great participation, assists and vision and few deaths out-rates an average mid", () => {
		const support = rate("support", performance("support", 90)).rating;
		const mid = rate("mid", performance("mid", 60)).rating;
		expect(support).toBeGreaterThan(mid);
	});

	it("explains the rating: every part has its value, score (in hundredths) and weight", () => {
		const { rating, parts } = rate("support", performance("support", 80));
		expect(parts.map((p) => p.metric).sort()).toEqual(
			["assists", "deaths", "kp", "vision"].sort(),
		);
		const total = parts.reduce((sum, p) => sum + p.score * p.weight, 0);
		expect(abs(rating - total / 10_000)).toBeLessThanOrEqual(0.5);
		for (const p of parts) expect(p.weight).toBe(WEIGHTS.support[p.metric]);
	});
});

describe("R3 · inputs", () => {
	it("share is per 10,000 and null without opportunities", () => {
		expect(share(1, 4)).toBe(2500);
		expect(share(0, 4)).toBe(0);
		expect(share(4, 4)).toBe(10_000);
		expect(share(0, 0)).toBeNull();
	});

	it("per30 scales a count to 30 minutes, in hundredths", () => {
		expect(per30(3, 1800)).toBe(300);
		expect(per30(3, 3600)).toBe(150);
		expect(per30(1, 1200)).toBe(150);
		expect(per30(5, 0)).toBeNull();
	});
});
