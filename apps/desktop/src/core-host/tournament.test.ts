import { competitionFacts } from "@rift-legends/contracts";
import { loadRealContent } from "@rift-legends/core";
import { describe, expect, test } from "vitest";
import { accepted, client } from "./season.fixtures";

// Plan 31, Q9 and Q10: a tournament is a season of one competition whose
// entrants are fixed teams.

type Core = ReturnType<typeof client>;
interface Slot {
	stage: string;
	league: string;
	place: number;
	team: string;
}
interface Stage {
	id: string;
	entrants: unknown;
	play: Record<string, unknown>;
}
interface Created {
	type: string;
	competitions: { id: string; fearless: string; stages: Stage[] }[];
	teams: { id: string; competition: string; region: string; rank: number }[];
	humanTeam?: string;
}

const fictional = [
	"forge",
	"shoal",
	"breakwater",
	"sunspoke",
	"nightjar",
	"switchyard",
	"longreach",
	"flintwake",
];
const base = { year: 2026, seed: 7 };
const preset = (id: string, extra: object = {}) => ({
	...base,
	format: { kind: "preset", preset: id },
	...extra,
});
const custom = (stages: object[], teams: string[], extra: object = {}) => ({
	...base,
	format: { kind: "custom", stages },
	teams,
	...extra,
});

/** The teams of `league`, best seed first. */
function bestOf(league: string) {
	return loadRealContent()
		.match.teams.filter((team) => team.league === league)
		.sort((a, b) => a.seed - b.seed)
		.map(({ id }) => id);
}

function slotsOf(core: Core, id: string): Slot[] {
	const result = core.query("tournament.preset", { preset: id });
	expect(result).toMatchObject({ ok: true });
	if (!("view" in result)) throw new Error("no preset view");
	return (result.view as { slots: Slot[] }).slots;
}

function created(core: Core, payload: object): Created {
	const facts = accepted(core.send("tournament.create", payload)).facts;
	const fact = facts[0] as unknown as Created;
	expect(fact.type).toBe("season.created");
	expect(competitionFacts.schema.safeParse(fact).success).toBe(true);
	return fact;
}

const rejected = (core: Core, payload: object) =>
	core.send("tournament.create", payload);

describe("Q9: presets fill the slots by region with the best seeds", () => {
	test("MSI lists its places per stage with the best seeds of each league", () => {
		const slots = slotsOf(client(), "msi");
		expect(slots.map(({ stage }) => stage)).toEqual([
			...Array(4).fill("playin"),
			...Array(7).fill("bracket"),
		]);
		for (const { league, place, team } of slots)
			expect(team, `${league} ${place}`).toBe(bestOf(league)[place - 1]);
		expect(slots[0]).toMatchObject({ league: "LCK", place: 2 });
	});

	test("Worlds and First Stand give one distinct team per slot and start", () => {
		for (const [id, count] of [
			["worlds", 19],
			["first-stand", 8],
		] as const) {
			const teams = slotsOf(client(), id).map(({ team }) => team);
			expect(teams).toHaveLength(count);
			expect(new Set(teams).size).toBe(count);
			created(client(), preset(id));
		}
	});

	test("the First Stand preset keeps the drawn groups with fixed teams", () => {
		const core = client();
		const slots = slotsOf(core, "first-stand");
		const [event] = created(core, preset("first-stand")).competitions;
		const teams = slots.map(({ team }) => team);
		expect(event?.stages[0]?.entrants).toEqual({
			kind: "fixed",
			teams,
			group: { index: 1, count: 2 },
		});
		expect(event?.stages[1]?.entrants).toEqual({
			kind: "fixed",
			teams,
			group: { index: 2, count: 2 },
		});
	});

	test("creating a preset without teams uses the filled slots as fixed entrants", () => {
		const core = client();
		const slots = slotsOf(core, "msi");
		const fact = created(core, preset("msi"));
		const [msi] = fact.competitions;
		expect(fact.competitions).toHaveLength(1);
		expect(msi?.id).toBe("msi");
		expect(msi?.stages[0]?.entrants).toEqual({
			kind: "fixed",
			teams: slots.slice(0, 4).map(({ team }) => team),
		});
		expect(msi?.stages[1]?.entrants).toEqual([
			{ kind: "fixed", teams: slots.slice(4).map(({ team }) => team) },
			{ kind: "bracket", stage: "playin", match: "GF", result: "winner" },
		]);
		const lck = fact.teams.find(({ id }) => id === slots[0]?.team);
		expect(lck).toMatchObject({ competition: "LCK", region: "LCK" });
	});

	test("the user can change a team, and pick it as theirs with fearless soft", () => {
		const core = client();
		const teams = slotsOf(core, "msi").map(({ team }) => team);
		const outsider = bestOf("LCK").find((id) => !teams.includes(id));
		if (!outsider) throw new Error("every LCK team is in");
		teams[0] = outsider;
		const fact = created(
			core,
			preset("msi", { teams, humanTeam: outsider, fearless: "soft" }),
		);
		expect(fact.humanTeam).toBe(outsider);
		expect(fact.competitions[0]?.fearless).toBe("soft");
		expect(fact.competitions[0]?.stages[0]?.entrants).toMatchObject({
			teams: [outsider, ...teams.slice(1, 4)],
		});
	});

	test("SO12: the MSI and Worlds presets keep their real draws, also with edited slots", () => {
		const core = client();
		const teams = slotsOf(core, "msi").map(({ team }) => team);
		const outsider = bestOf("LCK").find((id) => !teams.includes(id));
		if (!outsider) throw new Error("every LCK team is in");
		teams[4] = outsider;
		const [msi] = created(core, preset("msi", { teams })).competitions;
		expect(msi?.stages[1]?.entrants).toMatchObject([
			{ teams: [outsider, ...teams.slice(5)] },
			{ kind: "bracket" },
		]);
		expect(msi?.stages[1]).toMatchObject({
			draw: {
				meet: [
					[1, 4],
					[2, 3],
				],
				avoid: ["regionHalf"],
			},
		});
		const [worlds] = created(client(), preset("worlds")).competitions;
		const draws = worlds?.stages.map(
			(stage) => (stage as { draw?: object }).draw,
		);
		expect(draws).toEqual([
			{ tiers: [[1, 2, 3, 4]], meet: [], avoid: [] },
			{ pots: 4 },
			{
				tiers: [
					[1, 2],
					[3, 4, 5],
					[6, 7, 8],
				],
				meet: [[1, 3]],
				avoid: [],
			},
		]);
	});

	test("the same team twice is rejected at its second slot", () => {
		const core = client();
		const teams = slotsOf(core, "msi").map(({ team }) => team);
		teams[5] = teams[1] as string;
		expect(rejected(core, preset("msi", { teams }))).toMatchObject({
			ok: false,
			error: { code: "invalid-format", params: { path: "teams.5" } },
		});
	});

	test("a preset needs one team per slot and known teams", () => {
		const core = client();
		const teams = slotsOf(core, "msi").map(({ team }) => team);
		expect(
			rejected(core, preset("msi", { teams: teams.slice(1) })),
		).toMatchObject({
			ok: false,
			error: { code: "invalid-format", params: { path: "teams" } },
		});
		teams[2] = "nobody";
		expect(rejected(core, preset("msi", { teams }))).toMatchObject({
			ok: false,
			error: { code: "unknown-team", params: { team: "nobody" } },
		});
	});

	test("the user's team must play the tournament", () => {
		expect(
			rejected(client(), preset("msi", { humanTeam: "forge" })),
		).toMatchObject({
			ok: false,
			error: { code: "invalid-format", params: { path: "humanTeam" } },
		});
	});
});

describe("Q10: the simple editor builds up to two stages", () => {
	test("a league and a single-elimination final of the best four", () => {
		const core = client();
		const fact = created(
			core,
			custom(
				[
					{ type: "roundRobin", bestOf: 1 },
					{ type: "singleElim", size: 4, bestOf: 3 },
				],
				fictional.slice(0, 6),
			),
		);
		const [competition] = fact.competitions;
		expect(competition?.id).toBe("custom");
		expect(competition?.fearless).toBe("hard");
		expect(competition?.stages.map(({ play }) => play)).toEqual([
			{ type: "roundRobin", size: 6, rounds: 1, bestOf: 1 },
			{ type: "singleElim", size: 4, bestOf: [3, 3] },
		]);
		expect(competition?.stages[1]?.entrants).toMatchObject({
			kind: "standing",
			from: 1,
			to: 4,
		});
		const schedule = core.query("competition.schedule", {});
		expect(schedule).toMatchObject({ ok: true });
	});

	test("groups, Swiss and double elimination are valid first stages", () => {
		for (const stages of [
			[{ type: "groups", groups: 2, bestOf: 1 }],
			[
				{ type: "swiss", bestOf: 1 },
				{ type: "doubleElim", size: 4, bestOf: 3 },
			],
			[{ type: "doubleElim", bestOf: 5 }],
		])
			created(client(), custom(stages, fictional));
	});

	test("three teams in a knockout get a bye, not an error", () => {
		const core = client();
		const fact = created(
			core,
			custom([{ type: "singleElim", bestOf: 1 }], fictional.slice(0, 3)),
		);
		expect(fact.competitions[0]?.stages[0]?.play).toEqual({
			type: "singleElim",
			size: 3,
			bestOf: [1, 1],
		});
	});

	test("invalid shapes answer with the plan 12 errors", () => {
		const core = client();
		const cases: [object, object][] = [
			[
				custom(
					[{ type: "groups", groups: 4, bestOf: 1 }],
					fictional.slice(0, 6),
				),
				{ code: "invalid-format", params: { path: "stages.0.play.size" } },
			],
			[
				custom(
					[
						{ type: "roundRobin", bestOf: 1 },
						{ type: "singleElim", size: 8, bestOf: 1 },
					],
					fictional.slice(0, 4),
				),
				{ code: "not-enough-teams", params: { needed: 8, available: 4 } },
			],
			[
				custom([{ type: "doubleElim", bestOf: 1 }], fictional.slice(0, 6)),
				{ code: "invalid-format", params: { path: "stages.0.play.size" } },
			],
			[
				custom(
					[
						{ type: "singleElim", bestOf: 1 },
						{ type: "singleElim", size: 2, bestOf: 1 },
					],
					fictional,
				),
				{ code: "invalid-format", params: { path: "stages.1" } },
			],
			[
				custom(
					[
						{ type: "roundRobin", bestOf: 1 },
						{ type: "singleElim", bestOf: 1 },
					],
					fictional,
				),
				{ code: "invalid-format", params: { path: "stages.1.size" } },
			],
			[
				custom([{ type: "roundRobin", bestOf: 1 }], ["forge", "forge"]),
				{ code: "invalid-format", params: { path: "teams.1" } },
			],
			[
				{
					...base,
					format: {
						kind: "custom",
						stages: [{ type: "roundRobin", bestOf: 1 }],
					},
				},
				{ code: "invalid-format", params: { path: "teams" } },
			],
		];
		for (const [payload, error] of cases)
			expect(rejected(core, payload), JSON.stringify(payload)).toMatchObject({
				ok: false,
				error,
			});
	});

	test("a field too big for the calendar is format-too-long", () => {
		const teams = loadRealContent()
			.match.teams.slice(0, 32)
			.map(({ id }) => id);
		expect(
			rejected(client(), custom([{ type: "roundRobin", bestOf: 5 }], teams)),
		).toMatchObject({ ok: false, error: { code: "format-too-long" } });
	});
});

test("a running tournament is locked; a new one needs a new session", () => {
	const core = client();
	created(
		core,
		custom([{ type: "singleElim", bestOf: 1 }], fictional.slice(0, 4)),
	);
	expect(
		rejected(
			core,
			custom([{ type: "singleElim", bestOf: 1 }], fictional.slice(0, 4)),
		),
	).toMatchObject({ ok: false, error: { code: "format-locked" } });
});

test("tournament.check answers the error a create would give, without creating", () => {
	const core = client();
	const valid = custom(
		[{ type: "singleElim", bestOf: 1 }],
		fictional.slice(0, 4),
	);
	expect(core.query("tournament.check", valid)).toEqual({
		ok: true,
		view: { error: null },
	});
	expect(
		core.query(
			"tournament.check",
			custom([{ type: "doubleElim", bestOf: 1 }], fictional.slice(0, 6)),
		),
	).toEqual({
		ok: true,
		view: {
			error: {
				code: "invalid-format",
				params: { path: "stages.0.play.size" },
			},
		},
	});
	expect(core.query("competition.schedule", {})).toEqual({
		ok: true,
		view: [],
	});
	created(core, valid);
});

test("custom stages carry catalog names: the knockout is the elimination", () => {
	const names = (stages: object[], teams: string[]) => {
		const core = client();
		created(core, custom(stages, teams));
		const overview = core.query("season.overview", {}) as {
			view: { competitions: { stages: { stage: string; name?: object }[] }[] };
		};
		return overview.view.competitions[0]?.stages.map(({ stage, name }) => [
			stage,
			name,
		]);
	};
	expect(
		names(
			[
				{ type: "roundRobin", bestOf: 1 },
				{ type: "singleElim", size: 4, bestOf: 3 },
			],
			fictional,
		),
	).toEqual([
		["league", { stage: "league" }],
		["playoffs", { stage: "elimination" }],
	]);
	expect(
		names([{ type: "doubleElim", bestOf: 1 }], fictional.slice(0, 4)),
	).toEqual([["bracket", { stage: "elimination" }]]);
	expect(names([{ type: "swiss", bestOf: 1 }], fictional)).toEqual([
		["swiss", { stage: "swiss" }],
	]);
});
