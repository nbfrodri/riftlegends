import { describe, expect, it } from "vitest";
import {
	CONTRACT_VERSION,
	decodeFact,
	draftCommands,
	draftFacts,
	draftQueries,
	draftView,
	ERROR_CODES,
	encodeFact,
	parseCommand,
	parseQuery,
} from "../index";

const command = (kind: string, payload: unknown) => ({
	v: CONTRACT_VERSION,
	kind,
	sessionId: 1,
	expectedPosition: 0,
	payload,
});

const start = {
	teams: ["t1", "geng"],
	format: "bo5",
	fearless: "hard",
	timer: false,
	pool: ["ahri", "azir", "jinx"],
	seed: 42,
};

const roles = {
	top: "ksante",
	jungle: "vi",
	mid: "azir",
	bot: "jinx",
	support: "rell",
};

describe("draft commands", () => {
	it.each([
		["series.start", start],
		["series.start", { ...start, content: "real" }],
		["series.start", { ...start, content: "fictional" }],
		["side.choose", { team: "t1", choice: "blue" }],
		["side.choose", { team: "t1", choice: "red" }],
		["side.choose", { team: "t1", choice: "first" }],
		["side.choose", { team: "t1", choice: "last" }],
		["draft.ban", { team: "t1", champion: "ahri" }],
		["draft.ban", { team: "t1", champion: null }],
		["draft.pick", { team: "geng", champion: "azir" }],
		["draft.timeout", {}],
		["draft.roles", { team: "t1", roles }],
		["match.play", {}],
	])("accepts %s", (kind, payload) => {
		const parsed = parseCommand(draftCommands, command(kind, payload));
		expect(parsed.ok).toBe(true);
	});

	it.each([
		["the same team twice", "series.start", { ...start, teams: ["t1", "t1"] }],
		[
			"a repeated champion in the pool",
			"series.start",
			{ ...start, pool: ["ahri", "ahri"] },
		],
		["an unknown format", "series.start", { ...start, format: "bo7" }],
		[
			"an unknown fearless mode",
			"series.start",
			{ ...start, fearless: "medium" },
		],
		["a seed out of 32 bits", "series.start", { ...start, seed: 2 ** 32 }],
		[
			"an unknown content set",
			"series.start",
			{ ...start, content: "fantasy" },
		],
		[
			"seeds: game 1's priority is drawn",
			"series.start",
			{ ...start, seeds: [1, 2] },
		],
		["an unknown choice", "side.choose", { team: "t1", choice: "green" }],
		["the old side payload", "side.choose", { team: "t1", side: "blue" }],
		["an empty pick", "draft.pick", { team: "t1", champion: null }],
		["an empty champion id", "draft.pick", { team: "t1", champion: "" }],
		[
			"a missing role",
			"draft.roles",
			{ team: "t1", roles: { ...roles, support: undefined } },
		],
		[
			"an unknown role",
			"draft.roles",
			{ team: "t1", roles: { ...roles, adc: "x" } },
		],
	])("rejects %s", (_, kind, payload) => {
		const parsed = parseCommand(draftCommands, command(kind, payload));
		expect(parsed).toMatchObject({
			ok: false,
			error: { code: "invalid-command" },
		});
	});
});

describe("draft facts", () => {
	it.each([
		{
			type: "series.started",
			position: 0,
			teams: ["t1", "geng"],
			format: "bo3",
			fearless: "soft",
			timer: true,
			pool: ["ahri", "azir"],
			seed: 7,
		},
		{
			type: "side.chosen",
			position: 1,
			game: 1,
			team: "t1",
			kind: "order",
			choice: "last",
			by: "draw",
		},
		{
			type: "side.chosen",
			position: 2,
			game: 2,
			team: "geng",
			kind: "side",
			choice: "red",
			by: "rest",
		},
		{
			type: "ai.sideDecided",
			position: 2,
			game: 2,
			team: "geng",
			choice: "blue",
			total: 15000,
			components: [{ key: "blueSide", points: 15000 }],
			alternatives: [{ choice: "first", total: 10000, chance: 2000 }],
		},
		{
			type: "game.started",
			position: 2,
			game: 1,
			blue: "geng",
			red: "t1",
			first: "geng",
		},
		{
			type: "draft.banned",
			position: 3,
			game: 1,
			team: "geng",
			champion: null,
			timeout: true,
		},
		{
			type: "draft.picked",
			position: 4,
			game: 1,
			team: "t1",
			champion: "azir",
			timeout: false,
		},
		{ type: "draft.rolesAssigned", position: 5, game: 1, team: "t1", roles },
		{
			type: "series.started",
			position: 0,
			teams: ["t1", "geng"],
			format: "bo1",
			fearless: "off",
			timer: false,
			pool: ["ahri", "azir"],
			seed: 7,
			content: "real",
		},
		{ type: "game.finished", position: 6, game: 1, winner: "t1" },
		{ type: "series.finished", position: 7, winner: "t1", wins: [2, 1] },
	])("round-trips $type", (fact) => {
		expect(decodeFact(draftFacts, encodeFact(fact))).toEqual(fact);
	});
});

describe("series options", () => {
	const query = (params: unknown) =>
		parseQuery(draftQueries, {
			v: CONTRACT_VERSION,
			kind: "series.options",
			sessionId: 1,
			params,
		});

	it("asks for the session's content or for a named content set", () => {
		expect(query({}).ok).toBe(true);
		expect(query({ content: "real" }).ok).toBe(true);
		expect(query({ content: "fictional" }).ok).toBe(true);
		expect(query({ content: "fantasy" }).ok).toBe(false);
	});
});

describe("draft view", () => {
	it("reads the draft state of the session", () => {
		const parsed = parseQuery(draftQueries, {
			v: CONTRACT_VERSION,
			kind: "draft.view",
			sessionId: 1,
			params: {},
		});
		expect(parsed.ok).toBe(true);
	});

	it("describes turn, picks and why each champion is unavailable", () => {
		const view = {
			game: 2,
			wins: [1, 0],
			phase: "picks1",
			turn: { team: "t1", side: "blue", action: "pick" },
			choices: [
				{ team: "geng", choice: "last" },
				{ team: "t1", choice: "blue" },
			],
			first: "blue",
			blue: { team: "t1", bans: ["ahri", null], picks: ["azir"] },
			red: { team: "geng", bans: ["jinx"], picks: [] },
			availability: [
				{ champion: "ahri", status: "banned" },
				{ champion: "azir", status: "picked", team: "t1" },
				{ champion: "orianna", status: "fearless", team: "geng" },
				{ champion: "vi", status: "free" },
			],
		};
		expect(draftView.parse(view)).toEqual(view);
	});

	it("names who chooses and between what, before anyone has a side", () => {
		expect(
			draftView.shape.turn.safeParse({
				team: "t1",
				action: "side",
				options: ["blue", "red", "first", "last"],
			}).success,
		).toBe(true);
		expect(
			draftView.shape.turn.safeParse({ team: "t1", action: "side" }).success,
		).toBe(false);
		expect(
			draftView.shape.turn.safeParse({
				team: "t1",
				side: "blue",
				action: "result",
			}).success,
		).toBe(false);
	});

	it("has no turn once the series is over", () => {
		expect(
			draftView.safeParse({
				game: 3,
				wins: [2, 1],
				phase: "over",
				turn: null,
				choices: [],
				first: null,
				blue: { team: "t1", bans: [], picks: [] },
				red: { team: "geng", bans: [], picks: [] },
				availability: [],
			}).success,
		).toBe(true);
	});
});

describe("draft errors", () => {
	it("are part of the error codes", () => {
		expect(ERROR_CODES).toEqual(
			expect.arrayContaining([
				"not-your-turn",
				"wrong-action",
				"champion-unavailable",
				"invalid-roles",
				"pool-too-small",
				"series-over",
				"timer-off",
			]),
		);
	});
});
