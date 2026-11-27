import { describe, expect, it } from "vitest";
import { realSummonersSchema } from "../draft/real-summoners";

const spells = [
	{ id: "Flash", cooldown: 300 },
	{ id: "Ignite", cooldown: 180 },
	{ id: "Smite", cooldown: 15 },
	{ id: "Teleport", cooldown: 300 },
];
const defaults = {
	top: { spells: ["Flash", "Teleport"], games: 50 },
	jungle: { spells: ["Flash", "Smite"], games: 50 },
	mid: { spells: ["Flash", "Ignite"], games: 50 },
	bot: { spells: ["Flash", "Ignite"], games: 50 },
	support: { spells: ["Flash", "Ignite"], games: 50 },
};
const file = {
	provenance: {
		cooldowns: {
			source: "CommunityDragon",
			patch: "16.23",
			url: "https://raw.communitydragon.org/16.23/x.json",
			retrievedAt: "2026-11-27T10:00:00.000Z",
		},
		pairs: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			licence: "CC BY-SA 3.0",
			attribution: "x",
			season: 2026,
			minGames: 20,
			rows: 100,
		},
	},
	spells,
	roleDefaults: defaults,
	pairs: [
		{ champion: "Aatrox", role: "jungle", spells: ["Flash", "Smite"], games: 30, pairGames: 25 },
	],
};

describe("realSummonersSchema", () => {
	it("accepts a valid file", () => {
		expect(realSummonersSchema.parse(file)).toEqual(file);
	});
	it("rejects a pair with the same spell twice", () => {
		const pairs = [{ ...file.pairs[0], spells: ["Flash", "Flash"] }];
		expect(() => realSummonersSchema.parse({ ...file, pairs })).toThrow();
	});
	it("allows Smite only in the jungle and requires it there", () => {
		const top = { ...file.pairs[0], role: "top" };
		expect(() => realSummonersSchema.parse({ ...file, pairs: [top] })).toThrow();
		const noSmite = { ...file.pairs[0], spells: ["Flash", "Ignite"] };
		expect(() =>
			realSummonersSchema.parse({ ...file, pairs: [noSmite] }),
		).toThrow();
		expect(() =>
			realSummonersSchema.parse({
				...file,
				roleDefaults: { ...defaults, top: defaults.jungle },
			}),
		).toThrow();
	});
	it("keeps spell pairs sorted, and rows below the minimum out", () => {
		const unsorted = { ...file.pairs[0], spells: ["Smite", "Flash"] };
		expect(() =>
			realSummonersSchema.parse({ ...file, pairs: [unsorted] }),
		).toThrow();
		const few = { ...file.pairs[0], games: 19, pairGames: 19 };
		expect(() => realSummonersSchema.parse({ ...file, pairs: [few] })).toThrow();
	});
	it("rejects pairs that use a spell without cooldown, duplicates and extra keys", () => {
		const unknown = { ...file.pairs[0], spells: ["Flash", "Heal"], role: "mid" };
		expect(() =>
			realSummonersSchema.parse({ ...file, pairs: [unknown] }),
		).toThrow();
		expect(() =>
			realSummonersSchema.parse({ ...file, pairs: [file.pairs[0], file.pairs[0]] }),
		).toThrow();
		expect(() => realSummonersSchema.parse({ ...file, player: "x" })).toThrow();
	});
});
