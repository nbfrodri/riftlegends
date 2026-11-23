import { ROLES, type Role } from "@rift-legends/contracts";
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

/** Pro bands of plan 08 (Leaguepedia, 4,743 teams): mean, P10 and P90, in %. */
const KILL_SHARE: Record<Role, readonly [number, number, number]> = {
	top: [18.27, 0, 35.71],
	jungle: [22.63, 0, 42.86],
	mid: [24.91, 4.17, 45.45],
	bot: [29.05, 8.33, 50],
	support: [5.14, 0, 14.29],
};
const PARTICIPATION: Record<Role, readonly [number, number, number]> = {
	top: [51.84, 27.27, 75],
	jungle: [71.96, 50, 93.33],
	mid: [65.01, 42.86, 86.96],
	bot: [65.45, 41.67, 86.67],
	support: [73.99, 50, 94.44],
};

describe.each(["control", "packaged"] as const)(
	"C6: calibration with the %s pool",
	(pool) => {
		const even = sample(1000, 0, pool);

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

		describe("K6 · kills and participation by role", () => {
			const teams = even.flatMap((g) => g.teams).filter((t) => t.kills > 0);
			const percent = (values: number[]) => {
				const list = sorted(values);
				const mean = list.reduce((a, b) => a + b, 0) / list.length;
				return [mean, at(list, 0.1), at(list, 0.9)] as const;
			};
			const share = (role: Role, assists: boolean) =>
				percent(
					teams.map(
						(t) =>
							((t.line[role].kills + (assists ? t.line[role].assists : 0)) /
								t.kills) *
							100,
					),
				);
			const within = (
				got: readonly [number, number, number],
				want: readonly [number, number, number],
				[mean, edge]: [number, number],
			) => {
				expect(Math.abs(got[0] - want[0])).toBeLessThanOrEqual(mean);
				expect(Math.abs(got[1] - want[1])).toBeLessThanOrEqual(edge);
				expect(Math.abs(got[2] - want[2])).toBeLessThanOrEqual(edge);
			};

			it.each(ROLES)("%s kill share is within 3 pp of the pros", (role) => {
				within(share(role, false), KILL_SHARE[role], [3, 6]);
			});

			it.each(ROLES)("%s participation is within 5 pp of the pros", (role) => {
				within(share(role, true), PARTICIPATION[role], [5, 8]);
			});

			it("a kill has 2.0–2.6 assists on average", () => {
				const assists = teams.reduce(
					(sum, t) => sum + ROLES.reduce((n, r) => n + t.line[r].assists, 0),
					0,
				);
				const kills = teams.reduce((sum, t) => sum + t.kills, 0);
				expect(assists / kills).toBeGreaterThanOrEqual(2);
				expect(assists / kills).toBeLessThanOrEqual(2.6);
			});
		});

		it("K1 · a clear favourite (+10 on every attribute) wins 60–75 %", () => {
			const favourite = rate(sample(600, 10, pool), (g) => g.winner === "blue");
			expect(favourite).toBeGreaterThanOrEqual(0.6);
			expect(favourite).toBeLessThanOrEqual(0.75);
		});
	},
	60_000,
);
