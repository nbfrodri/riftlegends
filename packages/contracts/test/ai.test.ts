import { describe, expect, it } from "vitest";
import {
	aiContent,
	CONTRACT_VERSION,
	decodeFact,
	draftCommands,
	draftFacts,
	encodeFact,
	PERSONALITIES,
	parseCommand,
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
	format: "bo3",
	fearless: "hard",
	timer: false,
	pool: ["ahri"],
	seed: 1,
};

describe("AI settings in series.start", () => {
	it.each([
		["no AI", {}],
		[
			"AI on one side",
			{ ai: [null, { personality: "meta", coachRating: 35 }] },
		],
		["AI from the coach", { ai: ["coach", null] }],
		[
			"AI by difficulty",
			{ ai: [{ personality: "comfort", difficulty: "hard" }, null] },
		],
	])("accepts %s", (_, extra) => {
		expect(
			parseCommand(
				draftCommands,
				command("series.start", { ...start, ...extra }),
			).ok,
		).toBe(true);
	});

	it.each([
		["an unknown personality", { ai: [{ personality: "chaos" }, null] }],
		[
			"a coach rating above 5.0",
			{ ai: [{ personality: "meta", coachRating: 51 }, null] },
		],
		["a single entry", { ai: [{ personality: "meta" }] }],
	])("rejects %s", (_, extra) => {
		expect(
			parseCommand(
				draftCommands,
				command("series.start", { ...start, ...extra }),
			),
		).toMatchObject({
			ok: false,
			error: { code: "invalid-command" },
		});
	});

	it("offers the twelve personalities of plan 07", () => {
		expect(PERSONALITIES).toHaveLength(12);
	});
});

describe("draft.ai", () => {
	it("takes no payload", () => {
		expect(parseCommand(draftCommands, command("draft.ai", {})).ok).toBe(true);
		expect(
			parseCommand(draftCommands, command("draft.ai", { team: "t1" })).ok,
		).toBe(false);
	});
});

describe("ai.decided", () => {
	const fact = {
		type: "ai.decided",
		position: 3,
		game: 1,
		step: 7,
		team: "geng",
		action: "pick",
		champion: "azir",
		total: 182500,
		components: [
			{ key: "meta", points: 120000 },
			{ key: "comfort", points: 62500 },
		],
		alternatives: [
			{ champion: "orianna", total: 170000, chance: 2500 },
			{ champion: "ahri", total: 150000, chance: 900 },
		],
		reply: { champion: "syndra", points: -10000 },
	};

	it("round-trips in canonical form", () => {
		expect(decodeFact(draftFacts, encodeFact(fact))).toEqual(fact);
	});

	it("allows no reply and an empty ban", () => {
		const { reply: _, ...ban } = { ...fact, action: "ban", champion: null };
		expect(decodeFact(draftFacts, encodeFact(ban))).toEqual(ban);
	});
});

describe("AiContent", () => {
	const champion = {
		id: "azir",
		name: "Azir",
		positions: [{ role: "mid", tier: "S" }],
		damage: "magic",
		archetypes: ["carry", "poke"],
		power: "late",
	};
	const content = {
		champions: [
			champion,
			{ ...champion, id: "syndra", name: "Syndra" },
			{ ...champion, id: "rell", name: "Rell" },
		],
		matchups: [{ champion: "azir", against: "syndra", role: "mid", value: -3 }],
		synergies: [{ a: "azir", b: "rell", value: 4 }],
		identities: [{ id: "poke", archetypes: ["poke"], threshold: 3 }],
		players: [
			{
				id: "faker",
				team: "t1",
				role: "mid",
				level: 95,
				mains: ["azir"],
				secondary: [],
				weak: [],
			},
		],
	};

	it("accepts what the AI reads", () => {
		expect(aiContent.parse(content)).toEqual(content);
	});

	it.each([
		[
			"an unknown tier",
			{
				...content,
				champions: [
					{
						...content.champions[0],
						positions: [{ role: "mid", tier: "Z" }],
					},
				],
			},
		],
		[
			"a matchup out of range",
			{ ...content, matchups: [{ ...content.matchups[0], value: 11 }] },
		],
		[
			"an unknown archetype",
			{
				...content,
				champions: [{ ...content.champions[0], archetypes: ["wizard"] }],
			},
		],
		[
			"a player level above 100",
			{ ...content, players: [{ ...content.players[0], level: 101 }] },
		],
	])("rejects %s", (_, bad) => {
		expect(aiContent.safeParse(bad).success).toBe(false);
	});
});
