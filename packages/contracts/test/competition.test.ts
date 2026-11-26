import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json" with { type: "json" };
import es from "../../i18n/locales/es.json" with { type: "json" };
import {
	type Competition,
	competitionCommands,
	competitionFacts,
	competitionQueries,
	ERROR_CODES,
	errorKey,
	parseCommand,
	parseQuery,
	validateFormat,
} from "../index";

const roundRobin = {
	type: "roundRobin",
	size: 8,
	rounds: 1,
	bestOf: 3,
} as const;

const league = (): Competition => ({
	id: "lcs-spring",
	kind: "league",
	verified: false,
	tiebreak: [
		"seriesWins",
		"gameDiff",
		"headToHead",
		"tiebreakerSeries",
		"draw",
	],
	tiebreakerBestOf: 3,
	fearless: "hard",
	stages: [
		{
			id: "regular",
			window: { startWeek: 0, weeks: 8, matchDays: 3, maxSeriesPerDay: 4 },
			entrants: {
				kind: "fixed",
				teams: ["a", "b", "c", "d", "e", "f", "g", "h"],
			},
			play: roundRobin,
		},
		{
			id: "playoffs",
			window: { startWeek: 8, weeks: 3, matchDays: 2, maxSeriesPerDay: 4 },
			entrants: { kind: "standing", stage: "regular", from: 1, to: 8 },
			play: { type: "singleElim", size: 8, bestOf: [5, 5, 5] },
		},
	],
	slots: [
		{
			to: "msi",
			rule: "stageWinner",
			stage: "playoffs",
			count: 1,
			cascade: "next",
		},
	],
});

const withPlay = (play: object): unknown => {
	const c = league();
	return { ...c, stages: [{ ...c.stages[0], play }, c.stages[1]] };
};

const invalidAt = (raw: unknown, path: string) => {
	const result = validateFormat(raw);
	expect(result).toEqual({
		ok: false,
		error: { code: "invalid-format", params: { path } },
	});
};

describe("validateFormat (V2)", () => {
	it("accepts a well-formed league and defaults the tiebreaker series to Bo3", () => {
		const { tiebreakerBestOf: _, ...withoutBo } = league();
		const parsed = validateFormat(withoutBo);
		expect(parsed.ok && parsed.competition.tiebreakerBestOf).toBe(3);
	});

	it.each([2, 4, 0, 7])("rejects Bo%i", (bestOf) => {
		invalidAt(withPlay({ ...roundRobin, bestOf }), "stages.0.play.bestOf");
	});

	it("rejects a Bo outside 1, 3 and 5 in a bracket round and in the tiebreaker", () => {
		const c = league();
		invalidAt(
			{
				...c,
				stages: [
					c.stages[0],
					{
						...c.stages[1],
						play: { type: "singleElim", size: 8, bestOf: [5, 4, 5] },
					},
				],
			},
			"stages.1.play.bestOf.1",
		);
		invalidAt({ ...c, tiebreakerBestOf: 2 }, "tiebreakerBestOf");
	});

	it("rejects an empty group", () => {
		invalidAt(
			withPlay({
				type: "groups",
				size: 8,
				count: 0,
				seeding: "snake",
				inner: { rounds: 1, bestOf: 3 },
			}),
			"stages.0.play.count",
		);
		invalidAt(
			withPlay({
				type: "groups",
				size: 3,
				count: 2,
				seeding: "snake",
				inner: { rounds: 1, bestOf: 3 },
			}),
			"stages.0.play.size",
		);
	});

	it("rejects a Swiss whose rounds exceed teams minus one", () => {
		const swiss = {
			type: "swiss",
			size: 4,
			wins: 3,
			losses: 3,
			bestOf: 1,
			decisiveBestOf: 3,
			round1: "pots",
			avoid: ["region", "rematch"],
		};
		invalidAt(withPlay(swiss), "stages.0.play.size");
		expect(validateFormat(withPlay({ ...swiss, size: 16 })).ok).toBe(true);
	});

	it("rejects a bracket whose Bo list does not match its rounds", () => {
		const c = league();
		invalidAt(
			{
				...c,
				stages: [
					c.stages[0],
					{
						...c.stages[1],
						play: { type: "singleElim", size: 8, bestOf: [5, 5] },
					},
				],
			},
			"stages.1.play.bestOf",
		);
	});

	it("rejects repeated stage ids and a draw criterion that is not last", () => {
		const c = league();
		invalidAt(
			{ ...c, stages: [c.stages[0], { ...c.stages[1], id: "regular" }] },
			"stages.1.id",
		);
		invalidAt({ ...c, tiebreak: ["draw", "seriesWins"] }, "tiebreak.0");
	});

	it("rejects a window the per-day cap cannot exceed", () => {
		const c = league();
		invalidAt(
			{
				...c,
				stages: [
					{
						...c.stages[0],
						window: {
							startWeek: 0,
							weeks: 8,
							matchDays: 3,
							maxSeriesPerDay: 5,
						},
					},
					c.stages[1],
				],
			},
			"stages.0.window.maxSeriesPerDay",
		);
	});

	it("needs a stage reference on stage-based slots", () => {
		const c = league();
		invalidAt(
			{
				...c,
				slots: [{ to: "msi", rule: "standing", count: 1, cascade: "next" }],
			},
			"slots.0.stage",
		);
	});

	it("rejects non-objects and unknown fields", () => {
		invalidAt(null, "");
		invalidAt({ ...league(), extra: 1 }, "");
	});
});

describe("validateFormat, more rules", () => {
	const withStage = (stage: object) => {
		const c = league();
		return { ...c, stages: [c.stages[0], { ...c.stages[1], ...stage }] };
	};
	const double = {
		type: "doubleElim",
		size: 8,
		upper: [3, 5, 5],
		lower: [3, 3, 5, 5],
		drop: [[0, 0, 0, 0], [1, 1], [3]],
		grandFinal: 5,
		reset: false,
	};

	it("accepts a double elimination and checks its Bo and drop lists", () => {
		expect(validateFormat(withStage({ play: double })).ok).toBe(true);
		invalidAt(
			withStage({ play: { ...double, upper: [3, 5] } }),
			"stages.1.play.upper",
		);
		invalidAt(
			withStage({
				play: {
					...double,
					drop: [
						[0, 0, 0, 0],
						[1, 1],
					],
				},
			}),
			"stages.1.play.drop",
		);
	});

	it("accepts a double elimination without grand final (GSL) and keeps it required", () => {
		expect(
			validateFormat(withStage({ play: { ...double, grandFinal: null } })).ok,
		).toBe(true);
		const { grandFinal: _, ...missing } = double;
		invalidAt(withStage({ play: missing }), "stages.1.play.grandFinal");
		invalidAt(
			withStage({ play: { ...double, grandFinal: 2 } }),
			"stages.1.play.grandFinal",
		);
	});

	it("needs one drop per series of each upper round (null = eliminated)", () => {
		invalidAt(
			withStage({ play: { ...double, drop: [[0, 0, 0], [1, 1], [3]] } }),
			"stages.1.play.drop",
		);
		const lcp = {
			type: "doubleElim",
			size: 6,
			upper: [5, 5, 5],
			lower: [5, 5],
			drop: [[null, null], [0, 0], [1]],
			grandFinal: 5,
			reset: false,
		};
		expect(validateFormat(withStage({ play: lcp })).ok).toBe(true);
	});

	it("rejects a drop to a lower round that does not exist", () => {
		invalidAt(
			withStage({ play: { ...double, drop: [[0, 0, 0, 0], [1, 1], [4]] } }),
			"stages.1.play.drop",
		);
	});

	it("counts the lower entrants in size and keeps the upper bracket in step", () => {
		const lec = {
			type: "doubleElim",
			size: 6,
			upper: [3, 5],
			lower: [3, 5, 5],
			drop: [[0, 0], [2]],
			lowerSeeds: [2, 0, 0],
			grandFinal: 5,
			reset: false,
		};
		expect(validateFormat(withStage({ play: lec })).ok).toBe(true);
		invalidAt(
			withStage({ play: { ...lec, upper: [3, 5, 5] } }),
			"stages.1.play.upper",
		);
		invalidAt(
			withStage({ play: { ...lec, lowerSeeds: [2, 0, 0, 0] } }),
			"stages.1.play.lowerSeeds",
		);
		invalidAt(
			withStage({ play: { ...lec, lowerSeeds: [5, 0, 0] } }),
			"stages.1.play.lowerSeeds",
		);
	});

	it("rejects repeated tiebreak criteria", () => {
		invalidAt(
			{ ...league(), tiebreak: ["seriesWins", "seriesWins"] },
			"tiebreak",
		);
	});

	it("rejects a standing range that ends before it starts", () => {
		invalidAt(
			withStage({
				entrants: { kind: "standing", stage: "regular", from: 4, to: 2 },
			}),
			"stages.1.entrants.to",
		);
	});

	it("caps maxSeriesPerDay at 4, at least 1, and defaults it to 4", () => {
		const c = league();
		const win = (maxSeriesPerDay: number) => ({
			...c,
			stages: [
				{
					...c.stages[0],
					window: { startWeek: 0, weeks: 8, matchDays: 3, maxSeriesPerDay },
				},
				c.stages[1],
			],
		});
		invalidAt(win(0), "stages.0.window.maxSeriesPerDay");
		invalidAt(win(5), "stages.0.window.maxSeriesPerDay");
		expect(validateFormat(win(4)).ok).toBe(true);
		const { maxSeriesPerDay: _, ...bare } =
			c.stages[0]?.window ?? ({} as never);
		const parsed = validateFormat({
			...c,
			stages: [{ ...c.stages[0], window: bare }, c.stages[1]],
		});
		expect(
			parsed.ok && parsed.competition.stages[0]?.window.maxSeriesPerDay,
		).toBe(4);
	});

	it("rejects unknown fields in a nested object too", () => {
		const c = league();
		invalidAt(
			{
				...c,
				stages: [
					{ ...c.stages[0], window: { ...c.stages[0]?.window, extra: 1 } },
					c.stages[1],
				],
			},
			"stages.0.window",
		);
	});
});

describe("competition commands and queries", () => {
	const create = {
		v: 1,
		kind: "season.create",
		sessionId: 1,
		expectedPosition: 0,
		payload: {
			year: 2026,
			seed: 7,
			competitions: [league()],
			teams: [{ id: "a", competition: "lcs-spring", region: "na", rank: 1 }],
		},
	};

	it("parses season.create and season.playDay", () => {
		expect(parseCommand(competitionCommands, create).ok).toBe(true);
		expect(
			parseCommand(competitionCommands, {
				v: 1,
				kind: "season.playDay",
				sessionId: 1,
				expectedPosition: 3,
				payload: { day: 0 },
			}).ok,
		).toBe(true);
	});

	it("rejects an invalid format inside season.create with the field path", () => {
		const bad = structuredClone(create);
		const first = bad.payload.competitions[0]?.stages[0];
		if (first?.play.type !== "roundRobin") throw new Error("fixture changed");
		first.play.bestOf = 2 as never;
		const result = parseCommand(competitionCommands, bad);
		expect(result).toEqual({
			ok: false,
			error: {
				code: "invalid-command",
				params: { path: "payload.competitions.0.stages.0.play.bestOf" },
			},
		});
	});

	it("rejects a negative day and a season without competitions", () => {
		const day = {
			v: 1,
			kind: "season.playDay",
			sessionId: 1,
			expectedPosition: 0,
			payload: { day: -1 },
		};
		expect(parseCommand(competitionCommands, day).ok).toBe(false);
		const empty = structuredClone(create);
		empty.payload.competitions = [];
		expect(parseCommand(competitionCommands, empty).ok).toBe(false);
	});

	it("parses the four queries", () => {
		const q = (kind: string, params: object) =>
			parseQuery(competitionQueries, { v: 1, kind, sessionId: 1, params }).ok;
		expect(
			q("competition.standings", {
				competition: "lcs-spring",
				stage: "regular",
			}),
		).toBe(true);
		expect(
			q("competition.bracket", {
				competition: "lcs-spring",
				stage: "playoffs",
			}),
		).toBe(true);
		expect(q("competition.schedule", { competition: "lcs-spring" })).toBe(true);
		expect(q("competition.qualified", { competition: "msi" })).toBe(true);
		expect(q("competition.standings", {})).toBe(false);
	});
});

describe("competition facts", () => {
	const parse = (fact: object) =>
		competitionFacts.schema.safeParse(fact).success;

	it("accepts each fact type", () => {
		const base = { position: 0 };
		expect(
			parse({
				...base,
				type: "season.created",
				year: 2026,
				seed: 1,
				contentVersion: "c1",
				competitions: [league()],
				teams: [],
			}),
		).toBe(true);
		expect(
			parse({
				...base,
				type: "competition.seriesRecorded",
				competition: "lcs-spring",
				stage: "regular",
				day: 2,
				round: 0,
				teams: ["a", "b"],
				score: [2, 1],
				winner: "a",
				tiebreaker: false,
			}),
		).toBe(true);
		expect(
			parse({
				...base,
				type: "competition.stageFinished",
				competition: "lcs-spring",
				stage: "regular",
				standings: [
					{
						team: "a",
						rank: 1,
						seriesWins: 5,
						seriesLosses: 2,
						gameWins: 11,
						gameLosses: 6,
						explanation: {
							criterion: "headToHead",
							tied: ["a", "b"],
							values: { a: 2, b: 0 },
						},
					},
				],
			}),
		).toBe(true);
		expect(
			parse({
				...base,
				type: "competition.qualified",
				from: "lcs-spring",
				to: "msi",
				team: "a",
				rule: "stageWinner",
				via: "direct",
			}),
		).toBe(true);
		expect(
			parse({
				...base,
				type: "competition.paired",
				competition: "worlds",
				stage: "swiss",
				round: 1,
				pairs: [["a", "b"]],
				relaxed: ["region"],
			}),
		).toBe(true);
	});

	it("rejects a series whose winner is not one of its teams", () => {
		expect(
			parse({
				position: 0,
				type: "competition.seriesRecorded",
				competition: "c",
				stage: "s",
				day: 0,
				round: 0,
				teams: ["a", "b"],
				score: [2, 0],
				winner: "z",
				tiebreaker: false,
			}),
		).toBe(false);
	});

	it("rejects a pairing of a team with itself and unknown relaxations", () => {
		const paired = {
			position: 0,
			type: "competition.paired",
			competition: "w",
			stage: "s",
			round: 0,
			pairs: [["a", "a"]],
			relaxed: [],
		};
		expect(parse(paired)).toBe(false);
		expect(parse({ ...paired, pairs: [["a", "b"]], relaxed: ["luck"] })).toBe(
			false,
		);
	});
});

describe("competition errors (V7)", () => {
	const codes = [
		"invalid-format",
		"not-enough-teams",
		"invalid-stage-ref",
		"slots-mismatch",
		"format-locked",
		"format-too-long",
	] as const;

	it("are error codes with an errors.* key in ES and EN", () => {
		for (const code of codes) {
			expect(ERROR_CODES).toContain(code);
			expect(es, code).toHaveProperty(errorKey(code));
			expect(en, code).toHaveProperty(errorKey(code));
		}
	});

	it("suggest a fix when the format is too long", () => {
		expect(es["errors.format-too-long"]).toMatch(/Bo|vuelta/);
		expect(en["errors.format-too-long"]).toMatch(/Bo|round/);
	});
});

describe("#535 competition rules", () => {
	const cup = {
		type: "groups",
		size: 8,
		count: 2,
		seeding: "cross",
		inner: { rounds: 1, bestOf: 3 },
		finalRound: { bestOf: 5, groupPoints: 2, week: 2 },
	};

	it("accepts the LEC criteria and keeps the default Bo3", () => {
		const { tiebreakerBestOf: _, ...c } = league();
		const tiebreak = [
			"seriesWins",
			"headToHead",
			"priorSplitRank",
			"strengthOfVictory",
			"victoryTime",
			"tiebreakerSeries",
			"draw",
		];
		expect(validateFormat({ ...c, tiebreak })).toMatchObject({
			ok: true,
			competition: { tiebreak, tiebreakerBestOf: 3 },
		});
	});

	it("accepts a last cross-group round and winner/loser group standings sources", () => {
		const c = league();
		expect(
			validateFormat({
				...c,
				stages: [
					{ ...c.stages[0], play: cup },
					{
						...c.stages[1],
						entrants: [
							{
								kind: "standing",
								stage: "regular",
								from: 1,
								to: 2,
								group: "winner",
							},
							{
								kind: "standing",
								stage: "regular",
								from: 1,
								to: 1,
								group: "loser",
							},
						],
					},
				],
			}),
		).toMatchObject({ ok: true });
	});

	it("rejects a special final round outside two equal cross-groups", () => {
		invalidAt(withPlay({ ...cup, size: 7 }), "stages.0.play.finalRound");
		invalidAt(
			withPlay({ ...cup, seeding: "snake" }),
			"stages.0.play.finalRound",
		);
	});
});
