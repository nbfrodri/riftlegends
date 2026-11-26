import { ROLES, type Role } from "@rift-legends/contracts";
import { test } from "vitest";
import { sample } from "./scenarios";

const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const at = (v: number[], s: number) => sorted(v)[Math.floor(v.length * s)] ?? 0;
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

test("probe", () => {
	const out: Record<string, unknown> = {};
	for (const pool of ["control", "packaged", "real"] as const) {
		const g = sample(1000, 0, pool);
		const teams = g.flatMap((x) => x.teams).filter((t) => t.kills > 0);
		const lead = (x: (typeof g)[number]) =>
			x.finalGold[x.winner] - x.finalGold[x.winner === "blue" ? "red" : "blue"];
		const long = g.filter((x) => x.minutes >= 30 && x.minutes <= 34);
		out[pool] = {
			K5: g.filter((x) => x.winner === "blue").length / g.length,
			K2: [
				at(
					g.map((x) => x.minutes),
					0.05,
				),
				at(
					g.map((x) => x.minutes),
					0.5,
				),
				at(
					g.map((x) => x.minutes),
					0.95,
				),
			],
			K3: at(
				g.map((x) => x.kills),
				0.5,
			),
			K16: {
				total: at(
					long.map((x) => x.finalGold.blue + x.finalGold.red),
					0.5,
				),
				lead50: at(long.map(lead), 0.5),
				lead90: at(long.map(lead), 0.9),
				lead10: at(long.map(lead), 0.1),
				behind: g.filter((x) => lead(x) < 0).length / g.length,
			},
			K6: Object.fromEntries(
				ROLES.map((r: Role) => [
					r,
					[
						mean(teams.map((t) => (t.line[r].kills / t.kills) * 100)).toFixed(
							2,
						),
						mean(
							teams.map(
								(t) => ((t.line[r].kills + t.line[r].assists) / t.kills) * 100,
							),
						).toFixed(2),
					],
				]),
			),
			K7: Object.fromEntries(
				ROLES.map((r: Role) => [
					r,
					mean(
						g.flatMap((x) => x.teams).map((t) => t.line[r].goldShare),
					).toFixed(2),
				]),
			),
			K18:
				g.filter((x) => x.streaks.some((s) => s.count === 5)).length / g.length,
			K26aces: mean(g.map((x) => x.plays.aces)),
			deaths: (g[0] as { deathTimes?: number[] }).deathTimes
				? "n/a"
				: undefined,
		};
	}
	console.log("PROBE", JSON.stringify(out));
}, 600_000);
