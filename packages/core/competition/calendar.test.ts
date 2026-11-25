import fc from "fast-check";
import { describe, expect, it } from "vitest";
import firstStand from "../content/real/formats/first-stand.json";
import msi from "../content/real/formats/msi.json";
import worlds from "../content/real/formats/worlds.json";
import internationals from "../content/real/internationals.json";
import { buildCalendar } from "../index";
import { abs } from "../math/int";
import type { StageOutcomes } from "./qualification";
import { type Fixture, roundRobin } from "./round-robin";
import { buildStageGraph } from "./stage-graph";
import { type SeasonTeam, type Stage, stageKey } from "./stage-model";

const window = { startWeek: 0, weeks: 2, matchDays: 7, maxSeriesPerDay: 4 };
const options = { year: 2026, seed: 42 };

const roster = (size: number, competition = "league"): SeasonTeam[] =>
	Array.from({ length: size }, (_, index) => ({
		id: `${competition}-${index + 1}`,
		competition,
		region: competition,
		rank: index + 1,
	}));

function leagueStage(
	teams: readonly SeasonTeam[],
	settings: Partial<Stage["window"]> = {},
	rounds: 1 | 2 = 1,
	id = "split",
): Stage {
	return {
		id,
		window: { ...window, ...settings },
		entrants: { kind: "fixed", teams: teams.map(({ id }) => id) },
		play: { type: "roundRobin", size: teams.length, rounds, bestOf: 3 },
	};
}

const league = (id: string, stages: Stage[]) => ({
	id,
	kind: "league",
	verified: false,
	tiebreak: [],
	stages,
});

function graph(formats: readonly unknown[], teams: readonly SeasonTeam[]) {
	const built = buildStageGraph(formats, teams);
	if (!built.ok) throw new Error(JSON.stringify(built.error));
	return built.graph;
}

function scheduled(result: ReturnType<typeof buildCalendar>) {
	if (!result.ok) throw new Error(JSON.stringify(result.error));
	return result.stages;
}

function pairKey({ a, b }: Fixture): string {
	return JSON.stringify([a, b].sort());
}

describe("season calendar", () => {
	it("C1 schedules league fixtures on integer days and explains a delayed series", () => {
		const teams = roster(4);
		const [stage] = scheduled(
			buildCalendar(
				graph([league("league", [leagueStage(teams)])], teams),
				options,
			),
		);

		expect(stage).toMatchObject({ startDay: 0, endDay: 14 });
		expect(stage?.series.map(({ day }) => day)).toEqual([0, 0, 1, 1, 2, 2]);
		expect(stage?.series[2]?.explanation).toMatchObject({
			rule: "first-available",
			earliestDay: 0,
			skipped: [{ day: 0, reason: "team-busy" }],
		});
	});

	it("C2 reserves the whole international window for qualified teams and orders league stages", () => {
		const teams = roster(4);
		const first = leagueStage(teams, { weeks: 1 }, 1, "qualifier");
		const next = leagueStage(teams, { startWeek: 1 }, 1, "next");
		const domestic = {
			...league("league", [first, next]),
			slots: [
				{
					to: "cup",
					rule: "standing",
					count: 2,
					stage: first.id,
					cascade: "next",
				},
			],
		};
		const cup = {
			id: "cup",
			kind: "international",
			verified: false,
			tiebreak: [],
			stages: [
				{
					...leagueStage(teams.slice(0, 2), {
						startWeek: 1,
						weeks: 1,
						matchDays: 1,
					}),
					entrants: { kind: "qualified", competition: "cup" },
				},
			],
		};
		const outcomes: StageOutcomes = new Map([
			[
				stageKey({ competition: "league", stage: first.id }),
				{
					standings: {
						pending: [],
						rows: teams.map(({ id, rank }) => ({
							team: id,
							rank,
							seriesWins: 0,
							seriesLosses: 0,
							gameWins: 0,
							gameLosses: 0,
							explanation: { criterion: "none", tied: [], values: {} },
						})),
					},
				},
			],
		]);

		const stages = scheduled(
			buildCalendar(graph([domestic, cup], teams), { ...options, outcomes }),
		);
		const qualifier = stages.find(({ ref }) => ref.stage === "qualifier");
		const international = stages.find(({ ref }) => ref.competition === "cup");
		const leagueSeries = stages.find(({ ref }) => ref.stage === "next")?.series;
		expect(qualifier?.series.at(-1)?.day).toBeLessThan(7);
		expect(international?.series[0]).toMatchObject({
			day: 7,
			teams: ["league-1", "league-2"],
		});
		expect(leagueSeries?.filter(({ day }) => day < 14)).toEqual([
			expect.objectContaining({ day: 7, teams: ["league-3", "league-4"] }),
		]);
		expect(leagueSeries?.filter(({ day }) => day >= 14)).toHaveLength(5);
	});

	it("C2 waits for a previous league stage even when both windows open together", () => {
		const teams = roster(2);
		const [first, second] = scheduled(
			buildCalendar(
				graph(
					[
						league("league", [
							leagueStage(teams),
							leagueStage(teams, {}, 1, "next"),
						]),
					],
					teams,
				),
				options,
			),
		);
		expect(first?.series[0]?.day).toBe(0);
		expect(second?.series[0]?.day).toBe(1);
	});

	it.each([
		[firstStand, [2, 2, 1, 1, 1, 1], "2026-03-16", [74, 74, 79]],
		[msi, [2, 2, 2, 2, 2, 1], "2026-06-28", [178, 183]],
		[worlds, [4, 4, 3, 3, 3, 2], "2026-10-15", [287, 295, 306]],
	] as const)(
		"C3 starts the 2026 $id within a week of each real stage",
		(format, slots, firstDate, realStarts) => {
			const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];
			const teams = leagues.flatMap((id) => roster(4, id));
			const domestic = leagues.map((id, index) => ({
				...league(id, [
					leagueStage(teams.filter((team) => team.competition === id)),
				]),
				slots: [
					{
						to: format.id,
						rule: "standing",
						stage: "split",
						count: slots[index],
						cascade: "next",
					},
				],
			}));
			const event = internationals.events.find(({ id }) => id === format.id);
			expect(event?.matches[0]?.date).toBe(firstDate);

			const stages = scheduled(
				buildCalendar(graph([...domestic, format], teams), options),
			).filter(({ ref }) => ref.competition === format.id);
			expect(stages).toHaveLength(realStarts.length);
			for (const [index, stage] of stages.entries()) {
				expect(stage.series.length).toBeGreaterThan(0);
				expect(
					abs((stage.series[0]?.day as number) - (realStarts[index] as number)),
				).toBeLessThanOrEqual(7);
			}
		},
	);

	it("C4 packs four series from separate leagues onto the only match day", () => {
		const formats = Array.from({ length: 4 }, (_, index) => {
			const id = `league-${index}`;
			return league(id, [
				leagueStage(roster(2, id), { weeks: 1, matchDays: 1 }),
			]);
		});
		const teams = formats.flatMap(({ id }) => roster(2, id));

		const stages = scheduled(buildCalendar(graph(formats, teams), options));
		expect(
			stages.flatMap(({ series }) => series.map(({ day }) => day)),
		).toEqual([0, 0, 0, 0]);
	});

	it("C4 gives each competition its own four series per day", () => {
		const rosters = ["north", "south"].map((id) => roster(8, id));
		const formats = rosters.map((teams, index) =>
			league(
				index === 0 ? "north" : "south",
				[0, 1, 2, 3].map((pair) => ({
					...leagueStage(
						teams.slice(pair * 2, pair * 2 + 2),
						{ weeks: 1, matchDays: 1 },
						1,
						`pair-${pair}`,
					),
					parallelGroup: "pairs",
				})),
			),
		);

		const stages = scheduled(
			buildCalendar(graph(formats, rosters.flat()), options),
		);
		const days = stages.flatMap(({ series }) => series.map(({ day }) => day));
		expect(days).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it("C4 rejects a double round robin that cannot fit before the fixed season end", () => {
		const teams = roster(2);
		const stage = leagueStage(teams, { startWeek: 52, weeks: 2 }, 2);

		expect(
			buildCalendar(graph([league("league", [stage])], teams), options),
		).toMatchObject({
			ok: false,
			error: {
				code: "format-too-long",
				params: {
					competition: "league",
					stage: "split",
					needed: 2,
					available: 1,
				},
			},
		});
	});

	it("C4 uses the stage's smaller daily cap when set", () => {
		const teams = roster(4);
		const stage = leagueStage(teams, {
			weeks: 1,
			matchDays: 5,
			maxSeriesPerDay: 1,
		});

		expect(
			buildCalendar(graph([league("league", [stage])], teams), options),
		).toMatchObject({
			ok: false,
			error: { code: "format-too-long", params: { needed: 6, available: 5 } },
		});
	});
});

describe("calendar properties", () => {
	const alternatives = fc.record({
		size: fc.integer({ min: 2, max: 12 }),
		rounds: fc.constantFrom(1 as const, 2 as const),
		leagues: fc.integer({ min: 1, max: 3 }),
	});

	it.each([
		"team availability",
		"daily capacity",
		"fixture conservation",
		"determinism",
	] as const)("preserves %s across league calendars", (property) => {
		fc.assert(
			fc.property(alternatives, ({ size, rounds, leagues }) => {
				const rosters = Array.from({ length: leagues }, (_, i) =>
					roster(size, `league-${i}`),
				);
				const formats = rosters.map((teams, i) =>
					league(`league-${i}`, [leagueStage(teams, { weeks: 52 }, rounds)]),
				);
				const teams = rosters.flat();
				const stages = scheduled(buildCalendar(graph(formats, teams), options));
				const series = stages.flatMap((stage) => stage.series);
				expect(series.length).toBeGreaterThan(0);
				if (property === "determinism") {
					expect(
						buildCalendar(graph(formats, [...teams].reverse()), options),
					).toEqual({
						ok: true,
						stages,
					});
				} else if (property === "fixture conservation") {
					const expected = rosters.flatMap((teamList) =>
						roundRobin(
							teamList.map(({ id }) => id),
							rounds,
						).flatMap(({ fixtures }) => fixtures.map(pairKey)),
					);
					expect(
						series
							.map(({ teams: [a, b] }) =>
								pairKey({ a: a as string, b: b as string }),
							)
							.sort(),
					).toEqual(expected.sort());
					expect(new Set(series.map(({ id }) => id)).size).toBe(series.length);
				} else {
					const byDay = new Map<number, typeof series>();
					for (const match of series) {
						const day = byDay.get(match.day) ?? [];
						day.push(match);
						byDay.set(match.day, day);
					}
					for (const day of byDay.values()) {
						if (property === "daily capacity") {
							const perLeague = new Map<string, number>();
							for (const { id } of day) {
								const league = (JSON.parse(id) as string[])[0] as string;
								perLeague.set(league, (perLeague.get(league) ?? 0) + 1);
							}
							for (const count of perLeague.values())
								expect(count).toBeLessThanOrEqual(4);
						} else {
							const playing = day.flatMap(({ teams }) => teams);
							expect(new Set(playing).size).toBe(playing.length);
						}
					}
				}
			}),
		);
	});
});
