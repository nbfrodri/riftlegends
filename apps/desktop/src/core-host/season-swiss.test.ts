import { competitionViews } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season, teams } from "./season.fixtures";

// Plan 31, U7 (#487): the standings of a Swiss stage carry its rounds by
// balance, the constraints relaxed to pair each round and where each team ends.

type Core = ReturnType<typeof client>;

const [league] = season.competitions;
const stage = league?.stages[0];
/** Four teams of one region to 2 wins or 2 losses: round 1 cannot keep regions apart. */
const swiss = {
	...season,
	competitions: [
		{
			...league,
			stages: [
				{
					...stage,
					play: {
						type: "swiss",
						size: 4,
						wins: 2,
						losses: 2,
						bestOf: 1,
						decisiveBestOf: 1,
						round1: "pots",
						avoid: ["region"],
					},
				},
			],
		},
	],
};
const ref = { competition: "league", stage: "split" };

const view = (core: Core, kind: string, params: object = {}) => {
	const result = core.query(kind, params);
	if (!result.ok || !("view" in result))
		throw new Error(`${kind}: ${JSON.stringify(result)}`);
	return result.view;
};
const standings = (core: Core) =>
	competitionViews.standings.parse(view(core, "competition.standings", ref));

function playAll(core: Core) {
	for (
		let day = competitionViews.overview.parse(
			view(core, "season.overview"),
		).day;
		day !== null;
		day = competitionViews.overview.parse(view(core, "season.overview")).day
	)
		accepted(core.send("season.playDay", { day }));
}

test("U7: before any series, round 1 pairs everyone at 0-0 and says it relaxed the regions", () => {
	const core = client();
	accepted(core.send("season.create", swiss));
	expect(standings(core).swiss).toEqual({
		wins: 2,
		losses: 2,
		// Rounds the stage plays at most: 2 wins or 2 losses take three.
		totalRounds: 3,
		rounds: [
			{
				round: 1,
				relaxed: ["region"],
				series: [
					{ teams: [expect.any(String), expect.any(String)], record: [0, 0] },
					{ teams: [expect.any(String), expect.any(String)], record: [0, 0] },
				],
			},
		],
		teams: teams.map(({ id }) => ({
			team: id,
			wins: 0,
			losses: 0,
			status: "active",
		})),
	});
});

test("U7: once played, each round pools its series by balance and every team ends qualified or eliminated", () => {
	const core = client();
	accepted(core.send("season.create", swiss));
	playAll(core);
	const { swiss: view } = standings(core);
	expect(view?.rounds.map(({ round }) => round)).toEqual([1, 2, 3]);
	expect(
		view?.rounds.map(({ series }) =>
			series.map(({ record }) => record.join("-")).sort(),
		),
	).toEqual([["0-0", "0-0"], ["0-1", "1-0"], ["1-1"]]);
	for (const series of view?.rounds.flatMap((round) => round.series) ?? []) {
		expect(series.teams).toContain(series.winner);
		expect(series.score?.[0]).not.toBe(series.score?.[1]);
		// Its id opens the series.
		expect(
			core.query("series.summary", { series: series.series }),
		).toMatchObject({ ok: true });
	}
	expect(
		view?.teams
			.map(({ status, wins, losses }) => [status, wins, losses])
			.sort(),
	).toEqual([
		["eliminated", 0, 2],
		["eliminated", 1, 2],
		["qualified", 2, 0],
		["qualified", 2, 1],
	]);
});

test("U7: a league stage has no Swiss rounds", () => {
	const core = client();
	accepted(
		core.send("season.create", {
			...swiss,
			competitions: [
				{
					...league,
					stages: [
						{
							...stage,
							play: { type: "roundRobin", size: 4, rounds: 1, bestOf: 1 },
						},
					],
				},
			],
		}),
	);
	expect(standings(core)).not.toHaveProperty("swiss");
});
