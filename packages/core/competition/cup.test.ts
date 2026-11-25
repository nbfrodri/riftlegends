import { expect, test } from "vitest";
import { buildCalendar } from "./calendar";
import * as groupRules from "./groups";
import { buildStageGraph, resolveStage, stageKey } from "./season";
import * as standings from "./standings";
import { computeStandings, type Standings } from "./standings";

const teams = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const groupRef = { competition: "cup", stage: "groups" };
const playoffRef = { competition: "cup", stage: "playoffs" };
const window = { startWeek: 0, weeks: 3, matchDays: 7 };
const format = {
	id: "cup",
	kind: "league",
	verified: false,
	tiebreak: ["seriesWins", "gameDiff", "headToHead", "tiebreakerSeries"],
	stages: [
		{
			id: "groups",
			window,
			entrants: { kind: "fixed", teams },
			play: {
				type: "groups",
				size: 10,
				count: 2,
				seeding: "cross",
				inner: { rounds: 1, bestOf: 3 },
			},
		},
		{
			id: "playoffs",
			window: { ...window, startWeek: 3 },
			entrants: [
				{ kind: "standing", stage: "groups", from: 1, to: 2, group: "winner" },
				{ kind: "standing", stage: "groups", from: 1, to: 1, group: "loser" },
				{ kind: "standing", stage: "groups", from: 5, to: 5, group: "winner" },
			],
			play: { type: "singleElim", size: 4, bestOf: [5, 5] },
		},
	],
};

function graphFor(raw: unknown) {
	const built = buildStageGraph(
		[raw],
		teams.map((id, i) => ({
			id,
			competition: "cup",
			region: "cup",
			rank: i + 1,
		})),
	);
	expect(built.ok, JSON.stringify(built)).toBe(true);
	if (!built.ok) throw new Error(JSON.stringify(built.error));
	return built.graph;
}

test("Super Week schedules one Bo5 worth two points for every team in the final week", () => {
	const regular = format.stages[0];
	const graph = graphFor({
		...format,
		stages: [
			{
				...regular,
				play: {
					...regular?.play,
					finalRound: { bestOf: 5, groupPoints: 2, week: 2 },
				},
			},
		],
	});
	const calendar = buildCalendar(graph, { year: 2026, seed: 42 });
	if (!calendar.ok) throw new Error(JSON.stringify(calendar.error));
	const schedule = calendar.stages[0]?.series ?? [];
	const special = schedule.filter((series) => series.day >= 14);
	expect(schedule).toHaveLength(25);
	expect(special).toHaveLength(5);
	expect(special.flatMap(({ teams }) => teams).sort()).toEqual(teams);
	expect(
		special.every(
			(series) =>
				"bestOf" in series &&
				series.bestOf === 5 &&
				"groupPoints" in series &&
				series.groupPoints === 2,
		),
	).toBe(true);
	expect(
		schedule
			.filter((series) => series.day < 14)
			.every(
				(series) =>
					"bestOf" in series &&
					series.bestOf === 3 &&
					"groupPoints" in series &&
					series.groupPoints === 1,
			),
	).toBe(true);
});

test("the playoff picks come from both group tables, even with a contradictory combined table", () => {
	const graph = graphFor(format);
	const table = (order: string[]) =>
		computeStandings({
			teams: order,
			results: [],
			criteria: [],
			cuts: [],
			rootSeed: 0,
			scope: { competition: 0, stage: 0, season: 2026 },
		}).rows.map((row, i) => ({ ...row, team: order[i] as string }));
	const outcomes = new Map([
		[
			stageKey(groupRef),
			{
				standings: { rows: table(teams), pending: [] },
				groups: {
					winner: { rows: table(["H", "E", "A", "D", "I"]), pending: [] },
					loser: { rows: table(["J", "G", "F", "C", "B"]), pending: [] },
				},
			},
		],
	]);
	const resolved = resolveStage(graph, playoffRef, outcomes, 42, 2026);
	expect(
		resolved.status === "ready" && resolved.entrants.map(({ team }) => team),
	).toEqual(["H", "E", "J", "I"]);
});

test("double points flip the winning group and feed the first three playoff seeds", () => {
	const regular = format.stages[0];
	const graph = graphFor({
		...format,
		stages: [
			{
				...regular,
				play: {
					...regular?.play,
					finalRound: { bestOf: 5, groupPoints: 2, week: 2 },
				},
			},
			format.stages[1],
		],
	});
	const stage = resolveStage(graph, groupRef, new Map(), 42, 2026);
	if (stage.status !== "ready" || !stage.groups?.[0] || !stage.groups[1])
		throw new Error("Expected two groups");
	const calendar = buildCalendar(graph, { year: 2026, seed: 42 });
	if (!calendar.ok) throw new Error(JSON.stringify(calendar.error));
	const schedule = calendar.stages[0]?.series ?? [];
	const results = schedule.map((series, index) => {
		const [a, b] = series.teams;
		const bestOf = "bestOf" in series ? series.bestOf : undefined;
		const groupPoints =
			"groupPoints" in series ? series.groupPoints : undefined;
		if (
			!a ||
			!b ||
			typeof bestOf !== "number" ||
			typeof groupPoints !== "number"
		)
			throw new Error("Expected a Cup fixture");
		const aWins = index < 12 || index === 20;
		return {
			a,
			b,
			groupPoints,
			winsA: aWins ? (bestOf + 1) / 2 : 0,
			winsB: aWins ? 0 : (bestOf + 1) / 2,
		};
	});
	expect(groupRules).toHaveProperty(
		"computeGroupStandings",
		expect.any(Function),
	);
	if (
		!("computeGroupStandings" in groupRules) ||
		typeof groupRules.computeGroupStandings !== "function"
	)
		throw new Error("Missing group standings calculation");
	const groups: Record<"winner" | "loser", Standings & { points: number }> =
		groupRules.computeGroupStandings({
			groups: [stage.groups[0], stage.groups[1]],
			results,
			criteria: ["seriesWins", "gameDiff", "headToHead", "draw"],
			cuts: { winner: [2], loser: [1] },
			rootSeed: 42,
			scope: { competition: 0, stage: 0, season: 2026 },
		});
	expect([groups.winner.points, groups.loser.points]).toEqual([16, 14]);
	expect(
		groups.winner.rows.every(({ team }) => stage.groups?.[1]?.includes(team)),
	).toBe(true);
	expect(
		groups.winner.rows.reduce((wins, row) => wins + row.seriesWins, 0),
	).toBe(12);
	const playoffs = resolveStage(
		graph,
		playoffRef,
		new Map([[stageKey(groupRef), { groups, standings: groups.winner }]]),
		42,
		2026,
	);
	expect(
		playoffs.status === "ready" &&
			playoffs.entrants.slice(0, 3).map(({ team }) => team),
	).toEqual([
		groups.winner.rows[0]?.team,
		groups.winner.rows[1]?.team,
		groups.loser.rows[0]?.team,
	]);
});

test("a stage reads its configured prior split table when ranking a current tie", () => {
	const regular = {
		...format.stages[0],
		play: { type: "roundRobin", size: 10, rounds: 1, bestOf: 3 },
	};
	const graph = graphFor({
		...format,
		tiebreak: ["seriesWins", "headToHead", "priorSplitRank", "draw"],
		stages: [
			regular,
			{
				...regular,
				id: "next",
				tiebreakHistory: ["groups"],
				window: { ...window, startWeek: 3 },
			},
		],
	});
	const node = graph.nodes.get(stageKey({ competition: "cup", stage: "next" }));
	if (!node) throw new Error("Missing next stage");
	const results = [
		{ a: "A", b: "C", winsA: 2, winsB: 0 },
		{ a: "B", b: "D", winsA: 2, winsB: 0 },
	];
	const previous = computeStandings({
		teams,
		results: [{ a: "B", b: "A", winsA: 2, winsB: 0 }],
		criteria: ["seriesWins", "headToHead"],
		cuts: [],
		rootSeed: 42,
		scope: { competition: 0, stage: 0, season: 2026 },
	});
	expect(standings).toHaveProperty(
		"computeStageStandings",
		expect.any(Function),
	);
	if (
		!("computeStageStandings" in standings) ||
		typeof standings.computeStageStandings !== "function"
	)
		throw new Error("Missing stage standings calculation");
	const current: Standings = standings.computeStageStandings(
		node,
		new Map([[stageKey(groupRef), { standings: previous }]]),
		{
			teams,
			results,
			cuts: [],
			rootSeed: 42,
			season: 2026,
		},
	);
	expect(current.rows[0]).toMatchObject({
		team: "B",
		explanation: { criterion: "priorSplitRank" },
	});
});
