import { competitionViews } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season, teams, window } from "./season.fixtures";

// `competition.standings` as the standings screen reads it (plan 31, U3):
// rows, group tables and where each place leads.

type Core = ReturnType<typeof client>;

function query(core: Core, kind: string, params: object) {
	const result = core.query(kind, params);
	if (!result.ok || !("view" in result))
		throw new Error(`${kind}: ${JSON.stringify(result)}`);
	return result.view;
}

function exhibition(content: "fictional" | "real") {
	const core = client();
	const body = query(core, "season.exhibition", { content }) as object;
	accepted(core.send("season.create", { ...body, seed: 7 }));
	return core;
}

const standings = (core: Core, competition: string, stage: string) =>
	competitionViews.standings.parse(
		query(core, "competition.standings", { competition, stage }),
	);

const nextDay = (core: Core) =>
	competitionViews.overview.parse(query(core, "season.overview", {})).day;

/** Plays day after day until the stage has a table (it starts once its teams are known). */
function playUntilStarted(core: Core, competition: string, stage: string) {
	for (let day = nextDay(core); day !== null; day = nextDay(core)) {
		if (query(core, "competition.standings", { competition, stage }) !== null)
			return;
		accepted(core.send("season.playDay", { day }));
	}
}

test("U3: the league table says which places go on to the playoffs", () => {
	const table = standings(exhibition("fictional"), "rift-league", "regular");
	expect(table.rows).toHaveLength(8);
	expect(table.destinations).toEqual([
		{ from: 1, to: 4, competition: "rift-league", stage: "playoffs" },
	]);
});

test("U3: a stage that leads nowhere has no destinations", () => {
	const core = exhibition("fictional");
	playUntilStarted(core, "rift-league", "playoffs");
	expect(standings(core, "rift-league", "playoffs").destinations).toEqual([]);
}, 60_000);

test("U3: places to an international event read the stage the slot names", () => {
	const ids = teams.map(({ id }) => id);
	const core = client();
	accepted(
		core.send("season.create", {
			...season,
			competitions: [
				{
					...season.competitions[0],
					stages: [
						{
							id: "split",
							window,
							entrants: { kind: "fixed", teams: ids },
							play: { type: "roundRobin", size: 4, rounds: 1, bestOf: 1 },
						},
					],
					slots: [
						{
							to: "cup",
							rule: "standing",
							stage: "split",
							count: 2,
							cascade: "next",
						},
					],
				},
				{
					id: "cup",
					kind: "international",
					verified: false,
					tiebreak: ["seriesWins", "draw"],
					tiebreakerBestOf: 3,
					stages: [
						{
							id: "main",
							window: { ...window, startWeek: 3 },
							entrants: { kind: "qualified", competition: "cup" },
							play: { type: "roundRobin", size: 2, rounds: 1, bestOf: 1 },
						},
					],
				},
			],
		}),
	);
	expect(standings(core, "league", "split").destinations).toEqual([
		{ from: 1, to: 2, competition: "cup" },
	]);
});

test("U3: a cross-group stage gives one table per group, and its places say which group", () => {
	const core = exhibition("real");
	const groups = standings(core, "LCK", "cup-groups");
	expect(groups.groups?.winner.rows).toHaveLength(5);
	expect(groups.groups?.loser.rows).toHaveLength(5);
	expect(groups.destinations).toContainEqual({
		from: 1,
		to: 2,
		competition: "LCK",
		stage: "cup-playoffs",
		group: "winner",
	});
	expect(standings(core, "LCK", "rounds-1-2").destinations).toEqual([
		{ from: 1, to: 6, competition: "LCK", stage: "road-to-msi" },
		{ from: 1, to: 10, competition: "LCK", stage: "rounds-3-4" },
	]);
}, 60_000);
