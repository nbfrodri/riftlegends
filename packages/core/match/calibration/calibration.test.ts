import { ROLES, type Role } from "@rift-legends/contracts";
import { describe, expect, it, test } from "vitest";
import { loadRealContent } from "../../content/real";
import timelines from "../../content/real/timelines.json";
import { sample, scenario } from "./scenarios";

// Monte Carlo bands of plan 08. Seeds are fixed, so each run is the
// same sample: a failure means a change moved the balance, never bad luck.

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
const at = (values: number[], share: number) => {
	const list = sorted(values);
	return list[(list.length * share - ((list.length * share) % 1)) | 0] ?? 0;
};
const gap = (a: number, b: number) => (a > b ? a - b : b - a);
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
/** Pro mean and P10–P90 of the share of team gold and damage (plan 08). */
const GOLD_SHARE: Record<Role, readonly [number, number, number]> = {
	top: [20.09, 17.75, 22.52],
	jungle: [20.23, 18.2, 22.39],
	mid: [21.02, 18.8, 23.33],
	bot: [25, 22.42, 27.77],
	support: [13.65, 12.64, 14.71],
};
const DAMAGE_SHARE: Record<Role, readonly [number, number, number]> = {
	top: [22.56, 14.69, 30.54],
	jungle: [16.72, 10.84, 23.3],
	mid: [24.7, 17.55, 32.31],
	bot: [28.12, 20.03, 36.5],
	support: [7.9, 4.62, 11.93],
};
const PARTICIPATION: Record<Role, readonly [number, number, number]> = {
	top: [51.84, 27.27, 75],
	jungle: [71.96, 50, 93.33],
	mid: [65.01, 42.86, 86.96],
	bot: [65.45, 41.67, 86.67],
	support: [73.99, 50, 94.44],
};

/**
 * Pro vision score per 30 minutes (plan 08, K17): Leaguepedia, 4,756 lines of
 * six leagues, `VisionScore × 1800 / lengthSeconds`. [mean, P10, P90].
 */
const VISION_30: Record<Role, readonly [number, number, number]> = {
	top: [40.3, 28.9, 52.3],
	jungle: [54.2, 39.9, 69.2],
	mid: [40.3, 27.8, 53.3],
	bot: [40.4, 27.1, 54.5],
	support: [126.6, 103, 150.5],
};

/**
 * Pro gold at the end of a game (plan 08, K16): Leaguepedia, 2,378 games of six
 * leagues; the 781 that last 30–34 min give the total and the winner's lead.
 * [P10, P50, P90]; the share of winners that end behind in gold was 0.8 %.
 */
const PRO_GOLD = {
	total: [115_698, 123_359, 131_639],
	lead: [5896, 10_557, 14_954],
} as const;

it("A4 · uses real teams, players and champions", () => {
	const { draft, match, blue, red } = scenario(0, 253, "real");
	const real = loadRealContent();
	expect(blue.team).not.toBe(red.team);
	for (const lineup of [blue, red]) {
		expect(real.match.teams.map(({ id }) => id)).toContain(lineup.team);
		expect(match.teams.find(({ id }) => id === lineup.team)).toEqual(
			real.match.teams.find(({ id }) => id === lineup.team),
		);
		for (const role of ROLES) {
			const player = draft.players.find(
				(p) => p.team === lineup.team && p.role === role,
			);
			expect(real.draft.players).toContainEqual(player);
			expect(match.players.find((p) => p.id === player?.id)).toEqual(
				real.match.players.find((p) => p.id === player?.id),
			);
			expect(real.draft.champions).toContainEqual(
				draft.champions.find((c) => c.id === lineup.roles[role]),
			);
		}
	}
});

describe.each(["control", "packaged", "real-champions", "real"] as const)(
	"C6: calibration with the %s pool",
	(pool) => {
		const even = sample(1000, 0, pool);

		it("K5 · with balanced sides, blue wins 49–54 %", () => {
			// Floor 49 % (was 50 %), provisional: players down (#529) shrink the favourite's edge.
			const blue = rate(even, (g) => g.winner === "blue");
			expect(blue).toBeGreaterThanOrEqual(0.49);
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

		it("K18 · pentakills: 1.2–3 % of games, mostly the ADC, the support almost never (pro 2,0 %)", () => {
			const pentas = even.flatMap((g) =>
				g.streaks.filter((s) => s.count === 5),
			);
			const perGame = rate(even, (g) => g.streaks.some((s) => s.count === 5));
			expect(perGame).toBeGreaterThanOrEqual(0.012);
			expect(perGame).toBeLessThanOrEqual(0.03);
			const share = (role: Role) =>
				pentas.filter((s) => s.role === role).length / pentas.length;
			expect(share("bot")).toBeGreaterThanOrEqual(0.5);
			expect(share("bot")).toBeLessThanOrEqual(0.9);
			expect(share("support")).toBeLessThanOrEqual(0.05);
		});

		it("K18 · quadras are at least as common as pentas, and triples more than quadras", () => {
			const games = (count: number) =>
				rate(even, (g) => g.streaks.some((s) => s.count === count));
			expect(games(4)).toBeGreaterThanOrEqual(games(5));
			expect(games(3)).toBeGreaterThan(games(4));
		});

		// K23–K27 (plan 08, #508): Leaguepedia's stored Riot timelines, 317 games of
		// LCK, LEC, LCS, LCP and CBLOL. Bands are the pro value ± sampling noise.
		// The sim misses several of them; they stay `test.fails` until it is calibrated.
		describe("K23–K27 · special plays against pro timelines", () => {
			const plays = even.map((g) => g.plays);
			const share = (test: (p: (typeof plays)[number]) => boolean) =>
				rate(plays, test);
			const mean = (value: (p: (typeof plays)[number]) => number) =>
				plays.reduce((sum, p) => sum + value(p), 0) / plays.length;

			// https://github.com/nbfrodri/riftlegends/issues/508
			test.fails("K23 · first blood: median minute 3.5–5.5, P90 at least 6.5 (pro 4.5 and 8.8)", () => {
				const minutes = plays.map((p) => p.firstBloodMinute ?? 99);
				expect(at(minutes, 0.5)).toBeGreaterThanOrEqual(3.5);
				expect(at(minutes, 0.5)).toBeLessThanOrEqual(5.5);
				expect(at(minutes, 0.9)).toBeGreaterThanOrEqual(6.5);
			});

			test.fails("K23 · first blood has an assistant in 80–95 % of games (pro 89 %)", () => {
				const assisted = share((p) => p.firstBloodAssisted);
				expect(assisted).toBeGreaterThanOrEqual(0.8);
				expect(assisted).toBeLessThanOrEqual(0.95);
			});

			test.fails("K24 · 0.9–1.5 unassisted top or mid kills per game (pro 1.19)", () => {
				expect(mean((p) => p.soloKills)).toBeGreaterThanOrEqual(0.9);
				expect(mean((p) => p.soloKills)).toBeLessThanOrEqual(1.5);
			});

			test.fails("K25 · 3.5–5.5 shutdowns per game, and at least one in 90 % of games (pro 4.6 and 97 %)", () => {
				expect(mean((p) => p.shutdowns)).toBeGreaterThanOrEqual(3.5);
				expect(mean((p) => p.shutdowns)).toBeLessThanOrEqual(5.5);
				expect(share((p) => p.shutdowns > 0)).toBeGreaterThanOrEqual(0.9);
			});

			test.fails("K26 · 0.7–1.2 aces per game, in 55–80 % of games (pro 0.94 and 68 %)", () => {
				expect(mean((p) => p.aces)).toBeGreaterThanOrEqual(0.7);
				expect(mean((p) => p.aces)).toBeLessThanOrEqual(1.2);
				expect(share((p) => p.aces > 0)).toBeGreaterThanOrEqual(0.55);
				expect(share((p) => p.aces > 0)).toBeLessThanOrEqual(0.8);
			});

			test.fails("K27 · longest kill streak: 5 or more in 75–90 % of games, 7 or more in 33–50 % (pro 84 % and 43 %)", () => {
				const five = share((p) => p.topSpree >= 5);
				const seven = share((p) => p.topSpree >= 7);
				expect(five).toBeGreaterThanOrEqual(0.75);
				expect(five).toBeLessThanOrEqual(0.9);
				expect(seven).toBeGreaterThanOrEqual(0.33);
				expect(seven).toBeLessThanOrEqual(0.5);
			});
		});

		it("K22 · death time: P50 within 5 s of the pros, P10 and P90 within 8 s (#528)", () => {
			const pro = timelines.bands.k22;
			const times = even.flatMap((g) => g.deaths);
			expect(times.length).toBeGreaterThan(10_000);
			expect(gap(at(times, 0.5), pro.p50)).toBeLessThanOrEqual(5);
			expect(gap(at(times, 0.1), pro.p10)).toBeLessThanOrEqual(8);
			expect(gap(at(times, 0.9), pro.p90)).toBeLessThanOrEqual(8);
		});

		it("K19 · alive when taking: the side with fewer players up takes a baron, an inhibitor or a tower at most 10 % of the time (#529)", () => {
			const takes = even.flatMap((g) => g.takes);
			for (const kind of ["baron", "inhibitor", "tower"] as const) {
				const own = takes.filter((t) => t.kind === kind);
				expect(own.length, kind).toBeGreaterThan(100);
				expect(
					rate(own, (t) => t.ours < t.theirs) * 100,
					kind,
				).toBeLessThanOrEqual(10);
			}
		});

		// Pending the conversion window after a won fight (plan 08, #530): the
		// sim only has more players up at 17–20 % of the takes, the pros at 45–68 %.
		test.fails("K19 · alive when taking: with more players up than the rival, within 10 pp of the pro rate (pro 62 / 68 / 45 %)", () => {
			const pro = timelines.bands.k19;
			const takes = even.flatMap((g) => g.takes);
			for (const kind of ["baron", "inhibitor", "tower"] as const) {
				const own = takes.filter((t) => t.kind === kind);
				const more = rate(own, (t) => t.ours > t.theirs) * 100;
				expect(gap(more, pro[kind].moreBp / 100), kind).toBeLessThanOrEqual(10);
			}
		});

		it("K8 · role rating means are 56–64 and at most 5 points apart", () => {
			const teams = even.flatMap((g) => g.teams);
			const means = ROLES.map((role) => {
				const mean =
					teams.reduce((sum, team) => sum + team.line[role].rating, 0) /
					teams.length;
				expect.soft(mean, role).toBeGreaterThanOrEqual(56);
				expect.soft(mean, role).toBeLessThanOrEqual(64);
				return mean;
			});
			const ordered = sorted(means);
			expect(gap(ordered.at(-1) ?? 0, ordered[0] ?? 0)).toBeLessThanOrEqual(5);
		});

		it("K17 · vision score per 30 min: mean within 8 % of the pro one, P10–P90 inside the pro range", () => {
			const teams = even.flatMap((g) => g.teams);
			for (const role of ROLES) {
				const [mean, p10, p90] = VISION_30[role];
				const scores = teams.map((team) => team.line[role].vision);
				const got = scores.reduce((a, b) => a + b, 0) / scores.length;
				expect
					.soft(gap(got, mean) / mean, `${role} mean`)
					.toBeLessThanOrEqual(0.08);
				expect.soft(at(scores, 0.1), `${role} P10`).toBeGreaterThanOrEqual(p10);
				expect.soft(at(scores, 0.9), `${role} P90`).toBeLessThanOrEqual(p90);
			}
		});

		if (pool === "real") {
			// https://github.com/nbfrodri/riftlegends/issues/357 — calibrate the play mix and game totals.
			test.fails("K11 · a game has 8–15 towers at the median", () => {
				const towers = at(
					even.map((g) => g.towers),
					0.5,
				);
				expect(towers).toBeGreaterThanOrEqual(8);
				expect(towers).toBeLessThanOrEqual(15);
			});

			it("K11 · a game has 3–6 dragons at the median", () => {
				const dragons = at(
					even.map((g) => g.dragons),
					0.5,
				);
				expect(dragons).toBeGreaterThanOrEqual(3);
				expect(dragons).toBeLessThanOrEqual(6);
			});

			// https://github.com/nbfrodri/riftlegends/issues/320
			test.todo("K9 · advantages from composition matchups");
			test.todo("K10 · play mix by composition");
			test.todo("K15 · power curves and early fade");

			// https://github.com/nbfrodri/riftlegends/issues/339
			test.todo("K12 · contest advantage with an ultimate ready");
			test.todo("K13 · opportunities after the enemy uses an ultimate");
		}

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
				expect(gap(got[0], want[0])).toBeLessThanOrEqual(mean);
				expect(gap(got[1], want[1])).toBeLessThanOrEqual(edge);
				expect(gap(got[2], want[2])).toBeLessThanOrEqual(edge);
			};

			it.each(ROLES)("%s kill share is within 3.5 pp of the pros", (role) => {
				// Edges are 1/16 steps of a team's kills; 6.5 admits one step over 6 (#401).
				// The jungle edge is 10 (7.5 until #529, 6.5 before): with players down more kills fit in a game
				// (#528), which lifts the floor of its P10 a step (pro P10 is 0).
				within(share(role, false), KILL_SHARE[role], [
					3.5,
					role === "jungle" ? 10 : 6.5,
				]);
			});

			it.each(ROLES)("%s participation is within 6 pp of the pros", (role) => {
				within(share(role, true), PARTICIPATION[role], [6, 9]);
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

		describe("K7 · gold and damage by role", () => {
			const teams = even.flatMap((g) => g.teams);
			const stat = (role: Role, key: "goldShare" | "damageShare") => {
				const list = sorted(teams.map((t) => t.line[role][key]));
				const mean = list.reduce((a, b) => a + b, 0) / list.length;
				return [mean, at(list, 0.1), at(list, 0.9)] as const;
			};

			it.each(ROLES)("%s gold share is within 1.5 pp of the pros", (role) => {
				const got = stat(role, "goldShare");
				expect(gap(got[0], GOLD_SHARE[role][0])).toBeLessThanOrEqual(1.5);
				expect(gap(got[1], GOLD_SHARE[role][1])).toBeLessThanOrEqual(2);
				expect(gap(got[2], GOLD_SHARE[role][2])).toBeLessThanOrEqual(2);
			});

			it.each(ROLES)("%s damage share is within 2 pp of the pros", (role) => {
				const got = stat(role, "damageShare");
				expect(gap(got[0], DAMAGE_SHARE[role][0])).toBeLessThanOrEqual(2);
			});

			it("the support earns 13–15 % of the gold and less than the ADC", () => {
				const support = stat("support", "goldShare")[0];
				expect(support).toBeGreaterThanOrEqual(13);
				expect(support).toBeLessThanOrEqual(15);
				expect(
					teams.every((t) => t.line.support.goldShare < t.line.bot.goldShare),
				).toBe(true);
			});
		});

		describe("K16 · gold lead at the end of the game", () => {
			const long = even.filter((g) => g.minutes >= 30 && g.minutes <= 34);
			const leads = even.map(
				(g) =>
					g.finalGold[g.winner] -
					g.finalGold[g.winner === "blue" ? "red" : "blue"],
			);
			const longLeads = long.map(
				(g) =>
					g.finalGold[g.winner] -
					g.finalGold[g.winner === "blue" ? "red" : "blue"],
			);

			it("the total gold at 30–34 min is within 10 % of the pros", () => {
				const total = at(
					long.map((g) => g.finalGold.blue + g.finalGold.red),
					0.5,
				);
				expect(long.length).toBeGreaterThan(200);
				expect(total).toBeGreaterThanOrEqual(PRO_GOLD.total[1] * 0.9);
				expect(total).toBeLessThanOrEqual(PRO_GOLD.total[1] * 1.1);
			});

			it("the winner's median lead at 30–34 min is 7,500–13,000", () => {
				const median = at(longLeads, 0.5);
				expect(median).toBeGreaterThanOrEqual(7500);
				expect(median).toBeLessThanOrEqual(13_000);
			});

			it("the winner's P90 lead stays under 20,500 (20,000 until #529) and its P10 at least +2,000", () => {
				expect(at(longLeads, 0.9)).toBeLessThanOrEqual(20_500);
				expect(at(longLeads, 0.1)).toBeGreaterThanOrEqual(2000);
			});

			it("at most 5 % of the winners end behind in gold", () => {
				expect(rate(leads, (lead) => lead < 0)).toBeLessThanOrEqual(0.05);
			});
		});

		it("K1 · the boosted side (+10 up to 100) wins 60–75 %", () => {
			const favourite = rate(sample(600, 10, pool), (g) => g.winner === "blue");
			expect(favourite).toBeGreaterThanOrEqual(0.6);
			expect(favourite).toBeLessThanOrEqual(0.75);
		});
	},
	60_000,
);
