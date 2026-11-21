import { describe, expect, it } from "vitest";
import {
	CONTRACT_VERSION,
	decodeFact,
	draftCommands,
	draftFacts,
	encodeFact,
	MAP_ZONES,
	MATCH_EVENTS,
	matchContent,
	parseCommand,
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
	it("takes no payload", () => {
		expect(parseCommand(draftCommands, command("match.play", {})).ok).toBe(
			true,
		);
		expect(
			parseCommand(draftCommands, command("match.play", { winner: "t1" })).ok,
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
		for (const kind of ["dragon", "herald", "baron", "elder"]) {
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
	};
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
				chemistry: [{ a: "faker", b: "keria", value: 80 }],
				strategy: { tempo: "fast", objectives: "dragon", risk: "balanced" },
				adaptation: 70,
			},
		],
		champions: [{ id: "azir", cc: 4, mobility: 3, frontline: 1 }],
		rules: {
			objectives: {
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
				dragon: 200,
				herald: 300,
				baron: 1500,
				elder: 300,
			},
			goldWeight: [
				{ minute: 0, weight: 10000 },
				{ minute: 30, weight: 6000 },
			],
			blueSide: 300,
		},
	};

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
			"a gold weight above 100 %",
			{
				...content,
				rules: { ...content.rules, goldWeight: [{ minute: 0, weight: 10001 }] },
			},
		],
	])("rejects %s", (_, bad) => {
		expect(matchContent.safeParse(bad).success).toBe(false);
	});
});
