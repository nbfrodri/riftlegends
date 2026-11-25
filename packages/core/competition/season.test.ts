import { validateFormat } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildSingleElim, resolveBracket } from "./bracket";
import * as core from "../index";
import { computeStandings } from "./standings";

const api = core as typeof import("./season");

const window = { startWeek: 1, weeks: 1, matchDays: 2 };
const leaguePlay = { type: "roundRobin", size: 6, rounds: 1, bestOf: 3 };
const bracketPlay = { type: "singleElim", size: 2, bestOf: [3] } as const;
const stage = (
	id: string,
	entrants: unknown,
	play: unknown = leaguePlay,
	draw?: unknown,
) => ({ id, entrants, play, window, ...(draw ? { draw } : {}) });
const format = (id: string, stages: unknown[], slots?: unknown[]) => ({
	id,
	kind: slots ? "league" : "international",
	stages,
	slots,
	tiebreak: [],
	verified: false,
});
const fixed = (...teams: string[]) => ({ kind: "fixed", teams });
const standing = (
	stage: string,
	from: number,
	to: number,
	competition?: string,
) => ({
	kind: "standing",
	stage,
	from,
	to,
	...(competition ? { competition } : {}),
});
const match = (stage: string, match: string, result: "winner" | "loser") => ({
	kind: "bracket",
	stage,
	match,
	result,
});
const qualified = (competition: string) => ({ kind: "qualified", competition });
const teams = ["a", "b", "c", "d", "e", "f"];
const league = stage("league", fixed(...teams));
const table = (ids: string[]) =>
	computeStandings({
		teams: ids,
		results: [],
		cuts: [],
		criteria: [],
		bestOf: 3,
		seed: 17,
		scope: { competition: 0, season: 0, stage: 0 },
	});
const roster = (ids: string[], competition: string) =>
	ids.map((id, index) => ({
		id,
		competition,
		region: competition,
		rank: index + 1,
	}));
const build = (formats: unknown[], allTeams = roster(teams, "LCK")) => {
	const result = api.buildStageGraph?.(formats, allTeams);
	expect(result, "stage graph should validate").toMatchObject({ ok: true });
	if (!result?.ok) throw new Error("Invalid test graph");
	return result.graph;
};
const resolve = (
	graph: ReturnType<typeof build>,
	competition: string,
	stage: string,
	outcomes: Parameters<typeof api.resolveStage>[2] = new Map(),
	seed = 42,
) => api.resolveStage(graph, { competition, stage }, outcomes, seed, 2026);

describe("stage graph", () => {
	it("Q1 seeds ranked Legend and Rise groups from a final table and explains the source rank", () => {
		const graph = build([
			format("LCK", [
				league,
				stage("rounds34", standing("league", 1, 6), {
					type: "groups",
					size: 6,
					count: 2,
					seeding: "ranked",
					inner: { rounds: 2, bestOf: 3 },
				}),
			]),
		]);
		expect(resolve(graph, "LCK", "rounds34")).toMatchObject({
			status: "pending",
		});
		const standings = table(teams);
		const key = api.stageKey({ competition: "LCK", stage: "league" });
		const pending = [{ a: "a", b: "b", bestOf: 3 }];
		expect(
			resolve(
				graph,
				"LCK",
				"rounds34",
				new Map([[key, { standings: { ...standings, pending } }]]),
			),
		).toMatchObject({ status: "pending" });
		const result = resolve(
			graph,
			"LCK",
			"rounds34",
			new Map([[key, { standings }]]),
		);
		const order = standings.rows.map((r) => r.team);
		expect(result).toMatchObject({
			status: "ready",
			groups: [order.slice(0, 3), order.slice(3)],
			entrants: [
				{
					team: order[0],
					seed: 1,
					source: {
						kind: "standing",
						rank: 1,
						stage: { competition: "LCK", stage: "league" },
						explanation: standings.rows[0]?.explanation,
					},
				},
				...order
					.slice(1)
					.map((team, i) => expect.objectContaining({ team, seed: i + 2 })),
			],
		});
	});

	it("Q5 chains bracket winners and losers with a direct seed through a play-in ladder", () => {
		const graph = build([
			format("LCK", [
				stage("r1", fixed("a", "b"), bracketPlay),
				stage("r2", fixed("c", "d"), bracketPlay),
				stage(
					"r3",
					[match("r1", "U1-1", "loser"), match("r2", "U1-1", "winner")],
					bracketPlay,
				),
				stage(
					"main",
					[
						match("r1", "U1-1", "winner"),
						match("r3", "U1-1", "winner"),
						fixed("e"),
					],
					{ ...leaguePlay, size: 3 },
				),
			]),
		]);
		const bracket = buildSingleElim(bracketPlay);
		const outcomes = new Map([
			[
				api.stageKey({ competition: "LCK", stage: "r1" }),
				{ bracket: resolveBracket(bracket, ["a", "b"], { "U1-1": "a" }) },
			],
		]);
		expect(resolve(graph, "LCK", "r3", outcomes)).toMatchObject({
			status: "pending",
		});
		outcomes.set(api.stageKey({ competition: "LCK", stage: "r2" }), {
			bracket: resolveBracket(bracket, ["c", "d"], { "U1-1": "d" }),
		});
		expect(resolve(graph, "LCK", "r3", outcomes)).toMatchObject({
			status: "ready",
			entrants: [
				{
					team: "b",
					seed: 1,
					source: { kind: "bracket", match: "U1-1", result: "loser" },
				},
				{
					team: "d",
					seed: 2,
					source: { kind: "bracket", match: "U1-1", result: "winner" },
				},
			],
		});
		outcomes.set(api.stageKey({ competition: "LCK", stage: "r3" }), {
			bracket: resolveBracket(bracket, ["b", "d"], { "U1-1": "d" }),
		});
		expect(resolve(graph, "LCK", "main", outcomes)).toMatchObject({
			status: "ready",
			entrants: [
				{ team: "a", seed: 1 },
				{ team: "d", seed: 2 },
				{ team: "e", seed: 3, source: { kind: "fixed" } },
			],
		});
	});

	it.each([
		[standing("a", 1, 2), "invalid-stage-ref"],
		[standing("b", 1, 2), "invalid-stage-ref"],
		[standing("missing", 1, 2), "invalid-stage-ref"],
		[match("origin", "GF", "winner"), "invalid-stage-ref"],
		[standing("origin", 1, 7), "not-enough-teams"],
		[standing("origin", 1, 1), "not-enough-teams"],
		[[standing("origin", 1, 1), standing("origin", 1, 1)], "invalid-format"],
	])("V3–V4 rejects an invalid source %j with %s", (source, code) => {
		expect(
			api.buildStageGraph?.(
				[
					format("LCK", [
						stage("origin", fixed(...teams)),
						stage("a", source, bracketPlay),
						stage("b", fixed("a", "b"), bracketPlay),
					]),
				],
				roster(teams, "LCK"),
			),
		).toMatchObject({ ok: false, error: { code } });
	});

	it("V4 rejects cycles across competitions", () => {
		expect(
			api.buildStageGraph?.(
				[
					format("LCK", [stage("a", standing("b", 1, 2, "LEC"), bracketPlay)]),
					format("LEC", [stage("b", standing("a", 1, 2, "LCK"), bracketPlay)]),
				],
				[],
			),
		).toMatchObject({ ok: false, error: { code: "invalid-stage-ref" } });
	});

	it("detects duplicate teams after overlapping bracket and fixed sources resolve", () => {
		const graph = build([
			format("LCK", [
				stage("road", fixed("a", "b"), bracketPlay),
				stage(
					"playoffs",
					[fixed("a"), match("road", "U1-1", "winner")],
					bracketPlay,
				),
			]),
		]);
		const bracket = resolveBracket(buildSingleElim(bracketPlay), ["a", "b"], {
			"U1-1": "a",
		});
		const result = resolve(
			graph,
			"LCK",
			"playoffs",
			new Map([
				[api.stageKey({ competition: "LCK", stage: "road" }), { bracket }],
			]),
		);
		expect(result).toMatchObject({
			status: "error",
			error: { code: "invalid-format" },
		});
	});
});

const slot = (
	to: string,
	rule: string,
	stage: string,
	count = 1,
	cascade = "next",
) => ({ to, rule, stage, count, cascade });

describe("international slots and pots", () => {
	it("Q2–Q3 qualifies a split champion, cascades a repeat Road to MSI win, then awards points", () => {
		const graph = build([
			format(
				"LCK",
				[
					stage("split", fixed("a", "b"), bracketPlay),
					stage("road", fixed("a", "c"), bracketPlay),
					league,
				],
				[
					slot("msi", "stageWinner", "split"),
					slot("msi", "stageWinner", "road"),
					slot("msi", "points", "league"),
				],
			),
			format("msi", [
				stage("main", qualified("msi"), { ...leaguePlay, size: 3 }),
			]),
		]);
		const bracket = buildSingleElim(bracketPlay);
		const outcomes = new Map([
			[
				api.stageKey({ competition: "LCK", stage: "split" }),
				{
					bracket: resolveBracket(bracket, ["a", "b"], { "U1-1": "a" }),
				},
			],
			[
				api.stageKey({ competition: "LCK", stage: "road" }),
				{
					bracket: resolveBracket(bracket, ["a", "c"], { "U1-1": "a" }),
				},
			],
		]);
		expect(resolve(graph, "msi", "main", outcomes)).toMatchObject({
			status: "pending",
		});
		const result = resolve(
			graph,
			"msi",
			"main",
			new Map([
				...outcomes,
				[
					api.stageKey({ competition: "LCK", stage: "league" }),
					{
						points: new Map([
							["a", 20],
							["c", 19],
							["d", 15],
							["e", 9],
						]),
					},
				],
			]),
		);
		expect(result).toMatchObject({
			status: "ready",
			entrants: [
				{
					team: "a",
					source: {
						kind: "qualified",
						league: "LCK",
						rule: "stageWinner",
						via: "direct",
						rank: 1,
						place: 1,
					},
				},
				{
					team: "c",
					source: {
						kind: "qualified",
						league: "LCK",
						rule: "stageWinner",
						via: "cascade",
						rank: 2,
						place: 2,
						skipped: ["a"],
					},
				},
				{
					team: "d",
					source: {
						kind: "qualified",
						league: "LCK",
						rule: "points",
						via: "cascade",
						rank: 3,
						place: 3,
						points: 15,
						skipped: ["a", "c"],
					},
				},
			],
		});
	});

	it("Q3 leaves the place vacant when configured and reports the shortage", () => {
		const graph = build([
			format(
				"LCK",
				[league],
				[
					slot("msi", "standing", "league"),
					slot("msi", "standing", "league", 1, "vacant"),
				],
			),
			format("msi", [stage("main", qualified("msi"), bracketPlay)]),
		]);
		expect(
			resolve(
				graph,
				"msi",
				"main",
				new Map([
					[
						api.stageKey({ competition: "LCK", stage: "league" }),
						{ standings: table(teams) },
					],
				]),
			),
		).toMatchObject({
			status: "error",
			error: { code: "not-enough-teams", params: { needed: 2, available: 1 } },
		});
	});

	it("V5 rejects mismatched international allocations", () => {
		expect(
			api.buildStageGraph?.(
				[
					format("LCK", [league], [slot("msi", "standing", "league")]),
					format("msi", [stage("main", qualified("msi"), bracketPlay)]),
				],
				roster(teams, "LCK"),
			),
		).toMatchObject({ ok: false, error: { code: "slots-mismatch" } });
	});

	it("Q4 recalculates pots by regional place and draws groups without regional clashes", () => {
		const a = ["a1", "a2", "a3", "a4"];
		const b = ["b1", "b2", "b3", "b4"];
		for (const countA of [2, 3]) {
			const graph = build(
				[
					format(
						"LCK",
						[stage("split", fixed(...a), { ...leaguePlay, size: 4 })],
						[slot("worlds", "standing", "split", countA)],
					),
					format(
						"LEC",
						[stage("split", fixed(...b), { ...leaguePlay, size: 4 })],
						[slot("worlds", "standing", "split", 4 - countA)],
					),
					format("worlds", [
						stage(
							"groups",
							{ kind: "pots", from: ["LCK", "LEC"], pots: 2 },
							{
								type: "groups",
								size: 4,
								count: 2,
								seeding: "snake",
								inner: { rounds: 1, bestOf: 3 },
							},
							{ pots: 2, avoidSameLeague: true },
						),
					]),
				],
				[...roster(a, "LCK"), ...roster(b, "LEC")],
			);
			const standingsA = table(a);
			const standingsB = table(b);
			const outcomes = new Map([
				[
					api.stageKey({ competition: "LCK", stage: "split" }),
					{ standings: standingsA },
				],
				[
					api.stageKey({ competition: "LEC", stage: "split" }),
					{ standings: standingsB },
				],
			]);
			const result = resolve(graph, "worlds", "groups", outcomes);
			expect(result.status).toBe("ready");
			if (result.status !== "ready") throw new Error("Groups not ready");
			expect(
				result.entrants
					.filter((e) => e.pot === 1)
					.map((e) => e.team)
					.sort(),
			).toEqual([standingsA.rows[0]?.team, standingsB.rows[0]?.team].sort());
			expect(result.groups?.flat().sort()).toEqual(
				[
					...standingsA.rows.slice(0, countA),
					...standingsB.rows.slice(0, 4 - countA),
				]
					.map((row) => row.team)
					.sort(),
			);
			expect(
				result.groups?.filter((group) => group[0]?.[0] === group[1]?.[0]),
			).toHaveLength(countA - 2);
			expect(result.relaxed).toEqual(countA === 2 ? [] : ["league"]);
			expect(result).toEqual(resolve(graph, "worlds", "groups", outcomes));
		}
	});

	it("places each seed once across groups and is deterministic for any seed", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 2, max: 4 }),
				fc.integer({ min: 2, max: 5 }),
				fc.integer({ min: 0, max: 0xffffffff }),
				(count, perGroup, seed) => {
					const ids = Array.from(
						{ length: count * perGroup },
						(_, i) => `t${i}`,
					);
					const graph = build(
						[
							format("event", [
								stage(
									"groups",
									fixed(...ids),
									{
										type: "groups",
										size: ids.length,
										count,
										seeding: "snake",
										inner: { rounds: 1, bestOf: 3 },
									},
									{ pots: perGroup },
								),
							]),
						],
						roster(ids, "LCK"),
					);
					const result = resolve(graph, "event", "groups", new Map(), seed);
					expect(result.status).toBe("ready");
					if (result.status !== "ready") throw new Error("Groups not ready");
					expect(result.groups?.map((g) => g.length)).toEqual(
						Array(count).fill(perGroup),
					);
					expect(result.groups?.flat().sort()).toEqual([...ids].sort());
					expect(new Set(result.entrants.map((e) => e.seed)).size).toBe(
						ids.length,
					);
					expect(result).toEqual(
						resolve(graph, "event", "groups", new Map(), seed),
					);
				},
			),
		);
	});

	it("preserves ordinary fixed and standing format parsing", () => {
		expect(
			validateFormat(
				format("LCK", [
					league,
					stage("main", standing("league", 1, 2), bracketPlay),
				]),
			),
		).toMatchObject({ ok: true });
	});
});
