import { describe, expect, it } from "vitest";
import {
	CONTRACT_VERSION,
	decodeFact,
	draftCommands,
	draftFacts,
	draftQueries,
	encodeFact,
	MAP_ZONES,
	MATCH_EVENTS,
	matchContent,
	matchPlan,
	matchView,
	PLAYER_ATTRIBUTES,
	parseCommand,
	parseQuery,
	seriesSummary,
} from "../index";

const command = (kind: string, payload: unknown) => ({
	v: CONTRACT_VERSION,
	kind,
	sessionId: 1,
	expectedPosition: 0,
	payload,
});

const roundTrips = (fact: object) =>
	expect(decodeFact(draftFacts, encodeFact(fact))).toEqual(fact);
const rejects = (fact: object) =>
	expect(() => decodeFact(draftFacts, encodeFact(fact))).toThrow();

describe("match.play", () => {
	it("accepts an empty payload and rejects a supplied winner", () => {
		expect(parseCommand(draftCommands, command("match.play", {})).ok).toBe(
			true,
		);
		expect(
			parseCommand(draftCommands, command("match.play", { winner: "t1" })).ok,
		).toBe(false);
	});

	it("accepts a full strategy", () => {
		const strategy = { tempo: "fast", objectives: "dragon", risk: "risky" };
		expect(
			parseCommand(draftCommands, command("match.play", { strategy })).ok,
		).toBe(true);
	});

	it.each([
		null,
		{ tempo: "fast" },
		{ tempo: "quick", objectives: "dragon", risk: "safe" },
		{ tempo: "fast", objectives: "herald", risk: "safe" },
		{ tempo: "fast", objectives: "dragon", risk: "high" },
		{ tempo: "fast", objectives: "dragon", risk: "safe", team: "t1" },
	])("rejects an invalid strategy (%j)", (strategy) => {
		expect(
			parseCommand(draftCommands, command("match.play", { strategy })).ok,
		).toBe(false);
	});
});

describe("match.plan", () => {
	it("queries the current game without accepting a game parameter", () => {
		const query = { v: CONTRACT_VERSION, kind: "match.plan", sessionId: 1 };
		expect(parseQuery(draftQueries, { ...query, params: {} }).ok).toBe(true);
		expect(parseQuery(draftQueries, { ...query, params: { game: 2 } }).ok).toBe(
			false,
		);
	});

	it("validates the suggested strategy and signed integer causes", () => {
		const view = {
			game: 1,
			team: "t1",
			strategy: { tempo: "slow", objectives: "baron", risk: "safe" },
			causes: [{ key: "tempo.own.late", points: -20000 }],
		};
		expect(matchPlan.parse(view)).toEqual(view);
		expect(
			matchPlan.safeParse({
				...view,
				causes: [{ key: "tempo.own.late", points: -0.5 }],
			}).success,
		).toBe(false);
	});
});

describe("match.started", () => {
	const profile = {
		phases: { early: 52000, mid: 48000, late: 61000 },
		contests: {
			lane: 50000,
			jungle: 47000,
			fight: 55000,
			objective: 51000,
			siege: 49000,
		},
	};
	const fact = {
		type: "match.started",
		position: 30,
		game: 1,
		blue: "t1",
		red: "geng",
		profiles: { blue: profile, red: profile },
	};

	it("round-trips with a profile per side", () => roundTrips(fact));

	it("rejects a profile without a phase", () => {
		const { late: _, ...phases } = profile.phases;
		rejects({
			...fact,
			profiles: { blue: { ...profile, phases }, red: profile },
		});
	});
});

describe("match.event", () => {
	const fact = {
		type: "match.event",
		position: 31,
		game: 1,
		minute: 6,
		second: 42,
		kind: "kill",
		side: "blue",
		zone: "lane-bot",
		kills: [
			{ killer: "gumayusi", victim: "ruler", assists: ["keria", "oner"] },
		],
		gold: { blue: 400, red: 0 },
		chance: 5600,
		causes: [
			{ key: "lanes", points: 4000 },
			{ key: "matchup", points: -1500 },
		],
	};

	it("round-trips with its second, zone, kills and causes", () =>
		roundTrips(fact));

	it("carries a structure tier for towers", () =>
		roundTrips({
			...fact,
			kind: "tower",
			zone: "lane-top",
			kills: [],
			tier: 1,
		}));

	it("covers every kind of event and zone the minimap needs", () => {
		for (const kind of ["kill", "fight", "tower", "inhibitor", "nexus"]) {
			expect(MATCH_EVENTS).toContain(kind);
		}
		for (const kind of ["grub", "dragon", "herald", "baron", "elder"]) {
			expect(MATCH_EVENTS).toContain(kind);
		}
		for (const zone of ["lane-top", "dragon-pit", "baron-pit", "base-red"]) {
			expect(MAP_ZONES).toContain(zone);
		}
		expect(MAP_ZONES.filter((z) => z.startsWith("jungle-"))).toHaveLength(4);
	});

	it.each([
		["a second past 59", { second: 60 }],
		["an unknown zone", { zone: "fountain" }],
		["an unknown kind", { kind: "pentakill" }],
		["a chance above 10,000", { chance: 10001 }],
		["a tower tier above 4", { kind: "tower", tier: 5 }],
		["a negative minute", { minute: -1 }],
	])("rejects %s", (_, change) => rejects({ ...fact, ...change }));
});

describe("match.ended", () => {
	const line = {
		player: "faker",
		team: "t1",
		champion: "azir",
		kills: 4,
		deaths: 1,
		assists: 9,
		gold: 14200,
		damage: 28500,
		participation: 8125,
		rating: 84,
	};
	const fact = {
		type: "match.ended",
		position: 90,
		game: 1,
		winner: "t1",
		duration: 1934,
		players: [line],
		decisive: [
			{ event: 61, swing: 1800 },
			{ event: 44, swing: 1200 },
		],
	};

	it("round-trips with player stats and the decisive contests", () =>
		roundTrips(fact));

	it.each([
		[
			"a participation above 100 %",
			{ players: [{ ...line, participation: 10001 }] },
		],
		["a rating above 100", { players: [{ ...line, rating: 101 }] }],
		[
			"more than three decisive contests",
			{ decisive: Array.from({ length: 4 }, () => fact.decisive[0]) },
		],
	])("rejects %s", (_, change) => rejects({ ...fact, ...change }));
});

describe("MatchContent", () => {
	const attributes = {
		lanes: 80,
		teamfight: 85,
		macro: 90,
		mechanics: 88,
		composure: 95,
		resilience: 90,
		experience: 100,
		consistency: 85,
		shotcalling: 70,
		farming: 85,
		waves: 90,
		roaming: 95,
		vision: 80,
		anticipation: 92,
		objectiveControl: 75,
		positioning: 90,
		aggression: 60,
		focus: 95,
		communication: 90,
		versatility: 98,
	};
	const coach = { name: "Kuro", personality: "meta", rating: 35 };
	const content = {
		players: [
			{
				id: "faker",
				attributes,
				leader: true,
				mastery: [{ champion: "azir", value: 95 }],
			},
		],
		teams: [
			{
				id: "t1",
				name: "Team One",
				seed: 1,
				coach,
				chemistry: [{ a: "faker", b: "keria", value: 80 }],
				strategy: { tempo: "fast", objectives: "dragon", risk: "balanced" },
				adaptation: 70,
			},
		],
		champions: [{ id: "azir", cc: 4, mobility: 3, frontline: 1 }],
		rules: {
			objectives: {
				grub: { first: 480, despawn: 885 },
				dragon: { first: 300, respawn: 300 },
				herald: { first: 480, respawn: 360 },
				baron: { first: 1200, respawn: 360 },
				elder: { first: 2100, respawn: 360 },
			},
			inhibitorRespawn: 300,
			economy: {
				passive: 1200,
				kill: 300,
				assist: 150,
				tower: 550,
				inhibitor: 50,
				grub: 150,
				dragon: 200,
				herald: 300,
				baron: 1500,
				elder: 300,
			},
			fullBuildGold: 17000,
			goldOverflow: 1000,
			goldLeadPoints: 3400000,
			goldMaxPoints: 250000,
			blueSide: 300,
		},
	};

	it("rates twenty attributes in five areas", () => {
		expect(PLAYER_ATTRIBUTES).toHaveLength(20);
		expect(Object.keys(attributes).sort()).toEqual(
			[...PLAYER_ATTRIBUTES].sort(),
		);
	});

	it("accepts what the simulation reads", () => {
		expect(matchContent.parse(content)).toEqual(content);
	});

	it.each([
		[
			"an attribute above 100",
			{
				...content,
				players: [
					{ ...content.players[0], attributes: { ...attributes, macro: 101 } },
				],
			},
		],
		[
			"a player without an attribute",
			{
				...content,
				players: [
					{
						...content.players[0],
						attributes: { ...attributes, shotcalling: undefined },
					},
				],
			},
		],
		[
			"an unknown risk style",
			{
				...content,
				teams: [
					{
						...content.teams[0],
						strategy: { ...content.teams[0]?.strategy, risk: "yolo" },
					},
				],
			},
		],
		[
			"a champion stat above 10",
			{ ...content, champions: [{ ...content.champions[0], cc: 11 }] },
		],
		[
			"a gold overflow above 100 %",
			{
				...content,
				rules: { ...content.rules, goldOverflow: 10001 },
			},
		],
		[
			"a zero full build",
			{ ...content, rules: { ...content.rules, fullBuildGold: 0 } },
		],
	])("rejects %s", (_, bad) => {
		expect(matchContent.safeParse(bad).success).toBe(false);
	});

	it.each([
		[{ seed: 0 }, ["seed"]],
		[{ coach: { ...coach, personality: "chaos" } }, ["coach", "personality"]],
		[{ coach: { ...coach, rating: 51 } }, ["coach", "rating"]],
		[{ coach: { name: "Kuro", personality: "meta" } }, ["coach", "rating"]],
	])("validates the team's seed and coach (%j)", (change, path) => {
		const result = matchContent.safeParse({
			...content,
			teams: content.teams.map((team) => ({ ...team, ...change })),
		});
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({ path: ["teams", 0, ...path] }),
		);
	});
});

const side = {
	gold: 500,
	kills: 0,
	towers: { top: 0, mid: 0, bot: 0 },
	nexusTowers: 0,
	inhibitors: { top: null, mid: null, bot: null },
	dragons: 0,
	soul: false,
	grubs: 0,
	heralds: 0,
	barons: 0,
	elders: 0,
	buffs: { herald: null, baron: null, elder: null },
};
const player = {
	player: "p1",
	kills: 0,
	deaths: 0,
	assists: 0,
	gold: 100,
	cs: 8,
};
const snapshot = { minute: 1, blue: side, red: side, players: [player] };

describe("match.view", () => {
	const query = (params: unknown) =>
		parseQuery(draftQueries, {
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId: 1,
			params,
		});

	it("asks for one game", () => {
		expect(query({ game: 1 }).ok).toBe(true);
		expect(query({}).ok).toBe(false);
	});

	it("answers with the game and its match facts, without positions", () => {
		const view = {
			game: 1,
			facts: [
				{
					type: "match.ended",
					game: 1,
					winner: "t1",
					duration: 1800,
					players: [],
					decisive: [],
				},
			],
			snapshots: [snapshot],
		};
		expect(matchView.parse(view)).toEqual(view);
		expect(
			matchView.safeParse({
				game: 1,
				facts: [{ type: "game.finished" }],
				snapshots: [],
			}).success,
		).toBe(false);
		expect(
			matchView.safeParse({ ...view, snapshots: [{ ...snapshot, minute: -1 }] })
				.success,
		).toBe(false);
	});

	it("requires player stats with nonnegative integer counters in each snapshot", () => {
		const invalid = [
			{ minute: 1, blue: side, red: side },
			{ ...snapshot, players: [{ ...player, cs: -1 }] },
			{ ...snapshot, players: [{ ...player, gold: 0.5 }] },
		];
		for (const entry of invalid) {
			expect(
				matchView.safeParse({ game: 1, facts: [], snapshots: [entry] }).success,
			).toBe(false);
		}
	});
});

describe("series.summary", () => {
	it("asks for nothing and answers MVP and lane gaps", () => {
		const ask = parseQuery(draftQueries, {
			v: CONTRACT_VERSION,
			kind: "series.summary",
			sessionId: 1,
			params: {},
		});
		expect(ask.ok).toBe(true);
		const empty = { mvp: null, lanes: [] };
		expect(seriesSummary.parse(empty)).toEqual(empty);
		expect(seriesSummary.safeParse({ mvp: null }).success).toBe(false);
	});
});
