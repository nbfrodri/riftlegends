import { describe, expect, it } from "vitest";
import { sample } from "./scenarios";

// Monte Carlo bands of plan 08 (K1–K5). Seeds are fixed, so each run is the
// same sample: a failure means a change moved the balance, never bad luck.

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
const at = (values: number[], share: number) => {
	const list = sorted(values);
	return list[(list.length * share - ((list.length * share) % 1)) | 0] ?? 0;
};
const rate = <T>(list: readonly T[], test: (item: T) => boolean) =>
	list.filter(test).length / list.length;

describe("calibration", () => {
	const even = sample(1000);

	it("K5 · with equal teams, blue wins 50–54 %", () => {
		const blue = rate(even, (g) => g.winner === "blue");
		expect(blue).toBeGreaterThanOrEqual(0.5);
		expect(blue).toBeLessThanOrEqual(0.54);
	});

	it("K2 · games last 28–34 min at the median, 90 % within 22–45", () => {
		const minutes = even.map((g) => g.minutes);
		expect(at(minutes, 0.5)).toBeGreaterThanOrEqual(28);
		expect(at(minutes, 0.5)).toBeLessThanOrEqual(34);
		expect(at(minutes, 0.05)).toBeGreaterThanOrEqual(22);
		expect(at(minutes, 0.95)).toBeLessThanOrEqual(45);
	});

	it("K3 · a game has 15–30 kills at the median", () => {
		const kills = at(
			even.map((g) => g.kills),
			0.5,
		);
		expect(kills).toBeGreaterThanOrEqual(15);
		expect(kills).toBeLessThanOrEqual(30);
	});

	it("K4 · 3,000 gold behind at minute 20, a team wins 15–30 %", () => {
		const behind = even.filter(
			(g) =>
				g.goldAt20.blue - g.goldAt20.red >= 3000 ||
				g.goldAt20.red - g.goldAt20.blue >= 3000,
		);
		expect(behind.length).toBeGreaterThan(100);
		const comebacks = rate(
			behind,
			(g) => g.goldAt20.blue < g.goldAt20.red === (g.winner === "blue"),
		);
		expect(comebacks).toBeGreaterThanOrEqual(0.15);
		expect(comebacks).toBeLessThanOrEqual(0.3);
	});

	it("K1 · a clear favourite (+10 on every attribute) wins 60–75 %", () => {
		const favourite = rate(sample(600, 10), (g) => g.winner === "blue");
		expect(favourite).toBeGreaterThanOrEqual(0.6);
		expect(favourite).toBeLessThanOrEqual(0.75);
	});
}, 60_000);
