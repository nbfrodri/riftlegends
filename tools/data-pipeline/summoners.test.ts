import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	MIN_PAIR_GAMES,
	type RealSummoners,
	realSummonersSchema,
} from "@rift-legends/contracts/real-summoners";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import {
	acquireSummoners,
	aggregatePairs,
	readSpells,
	requireRoleDefaults,
	serializeSummoners,
} from "./summoners.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "summoners-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const catalog = [
	{ id: "Aatrox", key: 266, classes: [] },
	{ id: "Kaisa", key: 145, classes: [] },
	{ id: "MonkeyKing", key: 62, classes: [] },
];
const row = (champion: string, role: string, spells: string | null) => ({
	Champion: champion,
	Role: role,
	IngameRole: role,
	Spells: spells,
});
const many = (n: number, ...args: [string, string, string | null]) =>
	Array.from({ length: n }, () => row(...args));

const cdragon = [
	{ id: 4, name: "Flash", cooldown: 300, gameModes: ["CLASSIC", "ARAM"], iconPath: "/x/flash.png" },
	{ id: 14, name: "Ignite", cooldown: 180, gameModes: ["CLASSIC"], iconPath: "/x/ignite.png" },
	{ id: 11, name: "Smite", cooldown: 15, gameModes: ["CLASSIC"], iconPath: "/x/smite.png" },
	{ id: 12, name: "Teleport", cooldown: 300, gameModes: ["CLASSIC"], iconPath: "/x/tp.png" },
	{ id: 3, name: "Exhaust", cooldown: 210, gameModes: ["CLASSIC"], iconPath: "/x/e.png" },
	{ id: 7, name: "Heal", cooldown: 240, gameModes: ["CLASSIC"], iconPath: "/x/h.png" },
	{ id: 6, name: "Ghost", cooldown: 240, gameModes: ["CLASSIC"], iconPath: "/x/g.png" },
	{ id: 21, name: "Barrier", cooldown: 180, gameModes: ["CLASSIC"], iconPath: "/x/b.png" },
	{ id: 1, name: "Cleanse", cooldown: 240, gameModes: ["CLASSIC"], iconPath: "/x/c.png" },
	// Not on the Rift or a variant of another mode: ignored.
	{ id: 74, name: "Flash", cooldown: 300, gameModes: ["JADE"], iconPath: "/x/j.png" },
	{ id: 32, name: "Mark", cooldown: 80, gameModes: ["ARAM"], iconPath: "/x/m.png" },
	{ id: 54, name: "Placeholder", cooldown: 0, gameModes: [], iconPath: "/x/p.png" },
];

test("reads the cooldowns of the Rift spells and keeps no icon", () => {
	const spells = readSpells(cdragon);
	expect(spells).toHaveLength(9);
	expect(spells.find(({ id }) => id === "Flash")).toEqual({
		id: "Flash",
		cooldown: 300,
	});
	expect(JSON.stringify(spells)).not.toContain("png");
	expect(() => readSpells([])).toThrow();
	expect(() => readSpells(cdragon.filter(({ name }) => name !== "Flash"))).toThrow();
});

test("takes the usual pair of each champion and role, and counts its games", () => {
	const { pairs, roleDefaults } = aggregatePairs(
		[
			...many(15, "Kai'Sa", "Bot", "Ignite,Flash"),
			...many(10, "Kai'Sa", "Bot", "Flash,Heal"),
			...many(25, "Wukong", "Jungle", "Smite,Flash"),
			// Another role of the same champion has too few games.
			...many(3, "Kai'Sa", "Mid", "Flash,Ignite"),
		],
		catalog,
	);
	expect(pairs).toEqual([
		{ champion: "Kaisa", role: "bot", spells: ["Flash", "Ignite"], games: 25, pairGames: 15 },
		{ champion: "MonkeyKing", role: "jungle", spells: ["Flash", "Smite"], games: 25, pairGames: 25 },
	]);
	expect(roleDefaults.bot).toEqual({ spells: ["Flash", "Ignite"], games: 15 });
	expect(roleDefaults.jungle.spells).toEqual(["Flash", "Smite"]);
});

test("skips rows without a valid pair, role swaps and unknown champions", () => {
	const { pairs, skipped, rows } = aggregatePairs(
		[
			...many(MIN_PAIR_GAMES, "Aatrox", "Top", "Flash,Teleport"),
			...many(5, "Aatrox", "Top", null),
			...many(5, "Aatrox", "Top", "Flash,Flash"),
			...many(5, "Aatrox", "Top", "Flash,Unknown"),
			// Smite outside the jungle (a swapped role) and no Smite in the jungle.
			...many(5, "Aatrox", "Top", "Flash,Smite"),
			...many(5, "Aatrox", "Jungle", "Flash,Ignite"),
			...many(5, "Nobody", "Top", "Flash,Ignite"),
			...many(5, "Aatrox", "", "Flash,Ignite"),
		],
		catalog,
	);
	expect(pairs).toEqual([
		{ champion: "Aatrox", role: "top", spells: ["Flash", "Teleport"], games: 20, pairGames: 20 },
	]);
	expect(rows).toBe(20);
	expect(skipped).toBe(35);
});

test("a role without any pair stops the run", () => {
	const { roleDefaults } = aggregatePairs(
		many(20, "Aatrox", "Top", "Flash,Teleport"),
		catalog,
	);
	expect(() => requireRoleDefaults(roleDefaults)).toThrow(/jungle/);
});

test("ties go to the pair that sorts first, whatever the input order", () => {
	const input = [
		...many(20, "Aatrox", "Top", "Flash,Teleport"),
		...many(20, "Aatrox", "Top", "Flash,Ignite"),
	];
	const a = aggregatePairs(input, catalog).pairs;
	const b = aggregatePairs([...input].reverse(), catalog).pairs;
	expect(a).toEqual(b);
	expect(a[0]?.spells).toEqual(["Flash", "Ignite"]);
});

test("fetches politely, requests no personal data and caches only aggregates' inputs", async () => {
	let now = 0;
	const sleeps: number[] = [];
	const urls: URL[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
		const url = new URL(String(input));
		urls.push(url);
		expect(new Headers(init?.headers).get("user-agent")).toBe(
			"RiftLegendsDataPipeline/0.1",
		);
		if (url.hostname === "lol.fandom.com")
			return Response.json({
				cargoquery: [
					...many(MIN_PAIR_GAMES, "Aatrox", "Top", "Flash,Teleport"),
					...many(MIN_PAIR_GAMES, "Aatrox", "Jungle", "Smite,Flash"),
					...many(1, "Aatrox", "Mid", "Flash,Ignite"),
					...many(1, "Aatrox", "Bot", "Flash,Ignite"),
					...many(1, "Aatrox", "Support", "Flash,Heal"),
				].map((title) => ({ title })),
			});
		return Response.json(cdragon);
	});
	const client = new Client({
		cacheDir: dir,
		fetch,
		now: () => now,
		sleep: async (ms) => {
			sleeps.push(ms);
			now += ms;
		},
	});
	const first = await acquireSummoners(client, catalog, 2026, "2026-11-27", "16.23");
	expect(first.pairs).toHaveLength(2);
	const cargo = urls.find((url) => url.hostname === "lol.fandom.com");
	const fields = cargo?.searchParams.get("fields") ?? "";
	expect(fields).toContain("SP.SummonerSpells");
	// No player, team or game identifiers, and nothing to tell games apart.
	for (const forbidden of ["Link", "Name", "Team", "GameId", "Player"])
		expect(fields).not.toContain(forbidden);
	expect(cargo?.searchParams.get("where")).toContain("T.Year='2026'");
	expect(cargo?.searchParams.get("where")).toContain("< '2026-11-27'");
	expect(cargo?.searchParams.get("where")).toContain("LoL Champions Korea");
	const again = await acquireSummoners(client, catalog, 2026, "2026-11-27", "16.23");
	expect(again).toEqual(first);
	expect(fetch).toHaveBeenCalledTimes(2);
	for (const name of await readdir(dir))
		expect(await readFile(join(dir, name), "utf8")).not.toContain("iconPath");
});

test("the published file is deterministic and validates", async () => {
	const { pairs, roleDefaults, rows } = aggregatePairs(
		[
			...many(25, "Aatrox", "Top", "Flash,Teleport"),
			...many(25, "Aatrox", "Jungle", "Flash,Smite"),
			...many(25, "Aatrox", "Mid", "Flash,Ignite"),
			...many(25, "Aatrox", "Bot", "Flash,Heal"),
			...many(25, "Aatrox", "Support", "Flash,Exhaust"),
		],
		catalog,
	);
	const file: RealSummoners = {
		provenance: {
			cooldowns: {
				source: "CommunityDragon",
				patch: "16.23",
				url: "https://raw.communitydragon.org/16.23/x.json",
				retrievedAt: "2026-11-27T00:00:00.000Z",
			},
			pairs: {
				source: "Leaguepedia",
				domain: "lol.fandom.com",
				licence: "CC BY-SA 3.0",
				attribution: "x",
				season: 2026,
				minGames: MIN_PAIR_GAMES,
				rows,
			},
		},
		spells: readSpells(cdragon),
		roleDefaults: requireRoleDefaults(roleDefaults),
		pairs,
	};
	const text = serializeSummoners(file);
	expect(serializeSummoners(file)).toBe(text);
	expect(realSummonersSchema.parse(JSON.parse(text))).toEqual(file);
});

test("the published summoners.json validates and has no per-game data", async () => {
	const text = await readFile(
		new URL("../../packages/core/content/real/summoners.json", import.meta.url),
		"utf8",
	);
	const file = realSummonersSchema.parse(JSON.parse(text));
	expect(file.spells).toHaveLength(9);
	expect(file.pairs.length).toBeGreaterThan(0);
	expect(file.pairs.every(({ games }) => games >= MIN_PAIR_GAMES)).toBe(true);
	expect(Object.keys(JSON.parse(text))).toEqual([
		"provenance",
		"spells",
		"roleDefaults",
		"pairs",
	]);
});
