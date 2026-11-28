import { competitionFacts, competitionViews } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season, window } from "./season.fixtures";

// SO14 (plan 12 §6, #626): the bracket draw is announced once, the day its
// last source stage finishes and before its first series.

type Core = ReturnType<typeof client>;
const view = (core: Core, kind: string, params: object = {}) => {
	const result = core.query(kind, params);
	if (!result.ok || !("view" in result))
		throw new Error(`${kind}: ${JSON.stringify(result)}`);
	return result.view;
};
const [league] = season.competitions as [(typeof season.competitions)[0]];
const drawn = {
	...season,
	competitions: [
		{
			...league,
			stages: [
				...league.stages,
				{
					id: "playoffs",
					window: { ...window, startWeek: 2 },
					entrants: { kind: "standing", stage: "split", from: 1, to: 4 },
					play: { type: "singleElim", size: 4, bestOf: [1, 1] },
					draw: {
						tiers: [
							[1, 2],
							[3, 4],
						],
						meet: [[1, 2]],
						avoid: ["rematch"],
					},
				},
			],
		},
	],
};

test("SO14: competition.drawn comes once, after its source stage and before its first series", () => {
	const core = client();
	const facts = [...accepted(core.send("season.create", drawn)).facts];
	for (
		let day = competitionViews.overview.parse(
			view(core, "season.overview"),
		).day;
		day !== null;
		day = competitionViews.overview.parse(view(core, "season.overview")).day
	)
		facts.push(...accepted(core.send("season.playDay", { day })).facts);
	const draws = facts.filter(({ type }) => type === "competition.drawn");
	expect(draws).toHaveLength(1);
	const fact = draws[0] as (typeof draws)[number] & {
		pairs: [string, string][];
	};
	expect(competitionFacts.schema.safeParse(fact).success).toBe(true);
	const at = facts.indexOf(fact);
	const finished = facts.findIndex(
		(f) => f.type === "competition.stageFinished" && f.stage === "split",
	);
	const first = facts.findIndex(
		(f) => f.type === "competition.seriesRecorded" && f.stage === "playoffs",
	);
	expect(finished).toBeGreaterThanOrEqual(0);
	expect(finished).toBeLessThan(at);
	expect(at).toBeLessThan(first);
	const bracket = competitionViews.bracket.parse(
		view(core, "competition.bracket", {
			competition: "league",
			stage: "playoffs",
		}),
	);
	expect(
		bracket.matches
			.filter(({ round }) => round === 1)
			.map(({ teamA, teamB }) => [teamA, teamB]),
	).toEqual(fact.pairs);
	// A drawn series reopens by its id with the detail that was recorded.
	for (const match of bracket.matches.filter(({ round }) => round === 1)) {
		const recorded = facts.find(
			(f) =>
				f.type === "competition.seriesRecorded" &&
				f.stage === "playoffs" &&
				(f as { teams?: string[] }).teams?.join() ===
					[match.teamA, match.teamB].join(),
		) as { winner: string; score: [number, number] } | undefined;
		if (!recorded || !match.series) throw new Error("series not recorded");
		const summary = view(core, "series.summary", { series: match.series }) as {
			mvp: { team: string } | null;
			lanes: unknown[];
		};
		expect(match.score).toEqual(recorded.score);
		expect(summary.lanes).toHaveLength(recorded.score[0] + recorded.score[1]);
		expect(summary.mvp?.team).toBe(recorded.winner);
	}
});

test("SO15: the bracket view carries the draw of its stage, and only that", () => {
	const core = client();
	const facts = [...accepted(core.send("season.create", drawn)).facts];
	const ask = (stage: string) =>
		competitionViews.bracket.parse(
			view(core, "competition.bracket", { competition: "league", stage }),
		);
	for (
		let day = competitionViews.overview.parse(
			view(core, "season.overview"),
		).day;
		day !== null;
		day = competitionViews.overview.parse(view(core, "season.overview")).day
	) {
		facts.push(...accepted(core.send("season.playDay", { day })).facts);
		const bracket = facts.some((f) => f.type === "competition.drawn")
			? ask("playoffs")
			: null;
		const fact = facts.find((f) => f.type === "competition.drawn") as
			| { tiers: unknown; pairs: unknown; relaxed: unknown }
			| undefined;
		// Before, during and after its series the view tells the same draw.
		if (bracket && fact)
			expect(bracket.draw).toEqual({
				tiers: fact.tiers,
				pairs: fact.pairs,
				relaxed: fact.relaxed,
			});
	}
	expect(facts.some((f) => f.type === "competition.drawn")).toBe(true);
});
