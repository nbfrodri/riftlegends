import { describe, expect, it } from "vitest";
import { buildStageGraph, resolveStage, stageKey } from "../index";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { drawBracket } from "./bracket-draw";
import { computeStandings } from "./standings";

// The bracket draw inside the stage resolution (plan 12 §6, #626).

const window = { startWeek: 1, weeks: 1, matchDays: 2 };
const ids = ["a", "b", "c", "d", "e", "f"];
const quarters = { type: "singleElim", size: 4, bestOf: [3, 5] };
const draw = {
	tiers: [
		[1, 2],
		[3, 4],
	],
	meet: [[1, 2]],
	avoid: ["rematch"],
};
const graphWith = (playoffs: object) => {
	const built = buildStageGraph(
		[
			{
				id: "LCK",
				kind: "international",
				tiebreak: [],
				verified: false,
				stages: [
					{
						id: "league",
						window,
						entrants: { kind: "fixed", teams: ids },
						play: { type: "roundRobin", size: 6, rounds: 1, bestOf: 1 },
					},
					{
						id: "playoffs",
						window,
						entrants: { kind: "standing", stage: "league", from: 1, to: 4 },
						play: quarters,
						...playoffs,
					},
				],
			},
		],
		ids.map((id, index) => ({
			id,
			competition: "LCK",
			region: "LCK",
			rank: index + 1,
		})),
	);
	if (!built.ok) throw new Error(JSON.stringify(built.error));
	return built.graph;
};
const standings = computeStandings({
	teams: ids,
	results: [],
	cuts: [],
	criteria: [],
	rootSeed: 17,
	scope: { competition: 0, season: 0, stage: 0 },
});
const ranked = standings.rows.map(({ team }) => team);
const outcomes = (played: [string, string][] = []) =>
	new Map([
		[
			stageKey({ competition: "LCK", stage: "league" }),
			{
				standings,
				played: played.map((teams) => ({ fixture: { teams } })),
			},
		],
	]);
const resolve = (playoffs: object, seed: number, played?: [string, string][]) =>
	resolveStage(
		graphWith(playoffs),
		{ competition: "LCK", stage: "playoffs" },
		outcomes(played),
		seed,
		2026,
	);
const SEEDS = Array.from({ length: 32 }, (_, i) => i * 104729 + 3);

describe("bracket draw in resolveStage", () => {
	it("SO10: without a bracket draw the seeds follow the entry list", () => {
		const result = resolve({}, 42);
		expect(result).toMatchObject({
			status: "ready",
			entrants: ranked.slice(0, 4).map((team, i) => ({ team, seed: i + 1 })),
		});
		expect(result).not.toHaveProperty("draw");
	});

	it("SO2: the draw reads only its own stageDraw stream (competition, season, stage)", () => {
		expect(SCOPES.stageDraw).toBe(10);
		for (const seed of SEEDS) {
			const result = resolve({ draw }, seed);
			if (result.status !== "ready") throw new Error("not ready");
			const expected = drawBracket(
				{
					tiers: draw.tiers,
					meet: [[1, 2]],
					avoid: ["rematch"],
				},
				ranked.slice(0, 4).map((team, i) => ({
					team,
					region: "LCK",
					initialSeed: i + 1,
				})),
				() => false,
				createRng(deriveSeed(seed, SCOPES.stageDraw, 0, 2026, 1)),
			);
			expect(result.entrants.map(({ team }) => team)).toEqual(expected.order);
			expect(result.entrants.map(({ seed }) => seed)).toEqual([1, 2, 3, 4]);
			expect(result.draw).toEqual({
				tiers: expected.tiers,
				pairs: expected.pairs,
				relaxed: [],
			});
		}
	});

	it("SO6: rivals from an earlier stage of the competition do not meet again", () => {
		const [first, , third, fourth] = ranked as [string, string, string, string];
		for (const seed of SEEDS) {
			const result = resolve({ draw }, seed, [[first, third]]);
			if (result.status !== "ready") throw new Error("not ready");
			expect(result.draw?.pairs).toContainEqual([first, fourth]);
			expect(result.draw?.relaxed).toEqual([]);
		}
	});
});
