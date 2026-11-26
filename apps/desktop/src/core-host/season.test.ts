import { competitionFacts, draftFacts } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season, teams, window } from "./season.fixtures";

test("P2: plays every scheduled series through coach draft and match.play and projects Swiss results", () => {
	const core = client();
	const created = accepted(core.send("season.create", season));
	expect(created.facts.some(({ type }) => type === "competition.paired")).toBe(
		true,
	);
	const start = core.position();
	const day = accepted(core.send("season.playDay", { day: 0 }));
	for (const fact of day.facts) {
		const catalog = fact.type.startsWith("competition.")
			? competitionFacts
			: draftFacts;
		expect(catalog.schema.safeParse(fact).success, fact.type).toBe(true);
	}
	for (const type of [
		"series.started",
		"match.ended",
		"series.finished",
		"competition.seriesRecorded",
	]) {
		expect(day.facts.filter((fact) => fact.type === type)).toHaveLength(2);
	}
	expect(day.facts.find(({ type }) => type === "series.started")).toMatchObject(
		{ ai: ["coach", "coach"] },
	);
	const finish = day.facts.find(
		({ type }) => type === "competition.stageFinished",
	);
	expect(finish).toMatchObject({ competition: "league", stage: "split" });
	expect(
		core.query("competition.standings", {
			competition: "league",
			stage: "split",
		}),
	).toMatchObject({ ok: true, view: { rows: finish?.standings } });
	expect(core.send("season.playDay", { day: 0 }, start)).toEqual(day);
});

test("P3: rejected commands preserve queries and position", () => {
	const core = client();
	accepted(core.send("season.create", season));
	const before = core.query("competition.schedule", {});
	const position = core.position();
	expect(core.send("season.playDay", { day: 1 })).toMatchObject({ ok: false });
	expect(core.query("competition.schedule", {})).toEqual(before);
	expect(core.position()).toBe(position);
	expect(core.send("season.playDay", { day: 0 })).toMatchObject({ ok: true });
});

test("P4 and V6: formats are copied to the creation fact and only change next season", () => {
	const core = client();
	const created = accepted(core.send("season.create", season)).facts[0];
	expect(created).toMatchObject({
		type: "season.created",
		contentVersion: expect.any(String),
		competitions: season.competitions,
	});
	expect(competitionFacts.schema.safeParse(created).success).toBe(true);
	const replacement = {
		...season,
		competitions: [{ ...season.competitions[0], verified: true }],
	};
	expect(core.send("season.create", replacement)).toMatchObject({
		ok: false,
		error: { code: "format-locked" },
	});
	accepted(core.send("season.playDay", { day: 0 }));
	expect(
		accepted(core.send("season.create", { ...replacement, year: 2027 }))
			.facts[0],
	).toMatchObject({ year: 2027, competitions: replacement.competitions });
	expect(created?.competitions).toEqual(season.competitions);
});

test("a cut tiebreaker unlocks the international bracket and records the slot once", () => {
	const core = client();
	const roster = teams.slice(0, 2).map(({ id }) => id);
	const split = {
		id: "split",
		window,
		entrants: { kind: "fixed", teams: roster },
		play: { type: "roundRobin", size: 2, rounds: 1, bestOf: 1 },
	};
	accepted(
		core.send("season.create", {
			...season,
			competitions: [
				{
					...season.competitions[0],
					stages: [split],
					tiebreak: ["tiebreakerSeries"],
					slots: [
						{
							to: "cup",
							rule: "standing",
							stage: "split",
							count: 1,
							cascade: "next",
						},
					],
				},
				{
					id: "cup",
					kind: "international",
					verified: false,
					tiebreak: [],
					stages: [
						{
							id: "final",
							window: { ...window, startWeek: 2 },
							entrants: [
								{ kind: "qualified", competition: "cup" },
								{ kind: "fixed", teams: ["breakwater"] },
							],
							play: { type: "singleElim", size: 2, bestOf: [1] },
						},
					],
				},
			],
		}),
	);
	const regular = accepted(core.send("season.playDay", { day: 0 }));
	expect(
		regular.facts.some(({ type }) => type === "competition.stageFinished"),
	).toBe(false);
	expect(
		core.query("competition.schedule", {
			competition: "league",
			fromDay: 1,
			toDay: 1,
		}),
	).toMatchObject({
		ok: true,
		view: [{ day: 1, bestOf: 3, tiebreaker: true, status: "ready" }],
	});
	const tie = accepted(core.send("season.playDay", { day: 1 }));
	const winner = tie.facts.find(
		({ type }) => type === "competition.seriesRecorded",
	)?.winner;
	const qualified = tie.facts.filter(
		({ type }) => type === "competition.qualified",
	);
	expect(qualified).toMatchObject([
		{
			from: "league",
			to: "cup",
			team: winner,
			rule: "standing",
			via: "direct",
		},
	]);
	expect(
		core.query("competition.qualified", { competition: "cup" }),
	).toMatchObject({
		ok: true,
		view: [{ team: winner }],
	});
	expect(
		core.query("competition.bracket", { competition: "cup", stage: "final" }),
	).toMatchObject({
		ok: true,
		view: { matches: [{ priority: { team: winner }, status: "ready" }] },
	});
	const final = accepted(core.send("season.playDay", { day: 14 }));
	expect(
		final.facts.find(({ type }) => type === "ai.sideDecided"),
	).toMatchObject({ team: winner });
	expect(final.facts.some(({ type }) => type === "competition.qualified")).toBe(
		false,
	);
	expect(
		core.query("competition.bracket", { competition: "cup", stage: "final" }),
	).toMatchObject({
		ok: true,
		view: { matches: [{ status: "done" }] },
	});
});

test("Swiss finishes a round with an odd active field and removes unused reservations", () => {
	const core = client();
	const roster = [...teams, "nightjar", "switchyard"].map((team, index) =>
		typeof team === "string"
			? { ...teams[0], id: team, rank: index + 1 }
			: team,
	);
	const split = season.competitions[0]?.stages[0];
	accepted(
		core.send("season.create", {
			...season,
			teams: roster,
			competitions: [
				{
					...season.competitions[0],
					stages: [
						{
							...split,
							entrants: { kind: "fixed", teams: roster.map(({ id }) => id) },
							play: { ...split?.play, size: 6, wins: 1, losses: 2 },
						},
					],
				},
			],
		}),
	);
	const first = accepted(core.send("season.playDay", { day: 0 }));
	expect(
		first.facts.find(({ type }) => type === "competition.paired"),
	).toMatchObject({
		round: 2,
		pairs: [expect.any(Array)],
	});
	const last = accepted(core.send("season.playDay", { day: 1 }));
	expect(
		last.facts.some(({ type }) => type === "competition.stageFinished"),
	).toBe(true);
	expect(core.query("competition.schedule", { fromDay: 2 })).toEqual({
		ok: true,
		view: [],
	});
});
