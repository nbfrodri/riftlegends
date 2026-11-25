import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realTimelinesSchema } from "@rift-legends/contracts/real-timelines";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import {
	acquireTimelines,
	aggregate,
	deathSeconds,
	digestTimeline,
	type GameDigest,
	serializeTimelines,
} from "./timelines.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-timelines-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

// Death timer (LoL Wiki, "Death"): BRW + BRW x TIF, TIF in steps of 30 s.
test.each([
	[1, 5 * 60, 10],
	[1, 14 * 60 + 59, 10],
	[6, 14 * 60 + 59, 16],
	[6, 20 * 60, 17],
	[9, 14 * 60 + 59, 28],
	[9, 15 * 60 + 30, 29],
	[18, 30 * 60, 60],
	[18, 45 * 60, 64],
	[18, 55 * 60, 79],
	[18, 70 * 60, 79],
])(
	"death seconds at level %i and second %i is %i",
	(level, second, seconds) => {
		expect(deathSeconds(level, second)).toBe(seconds);
	},
);

const ms = (seconds: number) => seconds * 1000;
const rawTimeline = {
	participants: [{ participantId: 1, puuid: "secret-player-id" }],
	frames: [
		{
			participantFrames: { "1": { championStats: { armor: 36 } } },
			events: [
				{ type: "ITEM_PURCHASED", itemId: 1, participantId: 1, timestamp: 0 },
				{ type: "LEVEL_UP", level: 2, participantId: 1, timestamp: ms(70) },
				{ type: "LEVEL_UP", level: 3, participantId: 6, timestamp: ms(130) },
			],
		},
		{
			events: [
				{
					type: "CHAMPION_KILL",
					victimId: 6,
					killerId: 1,
					assistingParticipantIds: [2],
					timestamp: ms(200),
					victimDamageDealt: [{ name: "Ashe" }],
				},
				{
					type: "ELITE_MONSTER_KILL",
					monsterType: "BARON_NASHOR",
					killerTeamId: 100,
					timestamp: ms(1200),
				},
				{
					type: "ELITE_MONSTER_KILL",
					monsterType: "HORDE",
					killerTeamId: 100,
					timestamp: ms(300),
				},
				{
					type: "BUILDING_KILL",
					buildingType: "TOWER_BUILDING",
					teamId: 200,
					timestamp: ms(900),
				},
				{
					type: "BUILDING_KILL",
					buildingType: "INHIBITOR_BUILDING",
					teamId: 100,
					timestamp: ms(1300),
				},
				{ type: "GAME_END", winningTeam: 100, timestamp: ms(1500) },
			],
		},
	],
};

test("a timeline is reduced to deaths, level-ups, objectives and the end", () => {
	const digest = digestTimeline(rawTimeline);
	expect(digest).toEqual({
		end: 1500,
		winner: 100,
		deaths: [[200, 6]],
		levels: [[70], [], [], [], [], [130], [], [], [], []],
		objectives: [
			[900, "tower", 100],
			[1200, "baron", 100],
			// A destroyed building is credited to the other team.
			[1300, "inhibitor", 200],
		],
	});
	expect(JSON.stringify(digest)).not.toMatch(/secret|Ashe|armor/);
});

test("a malformed timeline is rejected", () => {
	expect(() => digestTimeline({ frames: [] })).toThrow();
	expect(() => digestTimeline("nope")).toThrow();
});

const game = (fields: Partial<GameDigest> = {}): GameDigest => ({
	end: 2000,
	winner: 100,
	deaths: [],
	levels: Array.from({ length: 10 }, () => []),
	objectives: [],
	...fields,
});
// Without level-ups everybody is level 1: a death lasts 10 s before 15:00.

test("K19 counts living players on each side when an objective falls", () => {
	const result = aggregate([
		// Blue takes the baron with red's jungler (7) dead: more alive.
		game({
			deaths: [[1190, 7]],
			objectives: [[1200, "baron", 100]],
		}),
		// Blue takes a tower with blue's top (1) dead: fewer alive.
		game({
			deaths: [[1195, 1]],
			objectives: [[1200, "tower", 100]],
		}),
		// The dead player already respawned: even numbers.
		game({
			deaths: [[1100, 7]],
			objectives: [[1200, "tower", 100]],
		}),
	]);
	expect(result.bands.k19.baron).toEqual({
		taken: 1,
		more: 1,
		fewer: 0,
		moreBp: 10000,
		fewerBp: 0,
	});
	expect(result.bands.k19.tower).toEqual({
		taken: 2,
		more: 0,
		fewer: 1,
		moreBp: 0,
		fewerBp: 5000,
	});
	expect(result.bands.k19.inhibitor.taken).toBe(0);
});

test("K20 measures conversion within 60 s by kill margin", () => {
	const red = (pid: number) => pid + 5;
	const result = aggregate([
		// One kill (margin 1) won by blue, tower 30 s later: converted.
		game({
			deaths: [[600, red(1)]],
			objectives: [[630, "tower", 100]],
		}),
		// Margin 1 again, but the objective is the loser's and too late.
		game({
			deaths: [[600, red(1)]],
			objectives: [
				[640, "tower", 200],
				[700, "dragon", 100],
			],
		}),
		// Kills 15 s apart are one fight: margin 3 (red loses 3, blue loses 0).
		game({
			deaths: [
				[900, red(1)],
				[912, red(2)],
				[925, red(3)],
			],
			objectives: [[940, "baron", 100]],
		}),
		// Even fight (one each): not counted.
		game({
			deaths: [
				[900, red(1)],
				[905, 2],
			],
			objectives: [[920, "tower", 100]],
		}),
	]);
	expect(result.bands.k20).toEqual([
		{ margin: "1", fights: 2, converted: 1, bp: 5000 },
		{ margin: "2", fights: 0, converted: 0, bp: 0 },
		{ margin: "3+", fights: 1, converted: 1, bp: 10000 },
	]);
});

test("K21 measures late fights that end the game and deaths at the nexus", () => {
	const result = aggregate([
		// Minute 26: red loses four players and blue wins within 60 s.
		game({
			end: 1600,
			winner: 100,
			deaths: [
				[1560, 6],
				[1565, 7],
				[1570, 8],
				[1575, 9],
			],
		}),
		// Same fight, but the game goes on for ten more minutes.
		game({
			end: 2200,
			winner: 100,
			deaths: [
				[1560, 6],
				[1565, 7],
				[1570, 8],
				[1575, 9],
			],
		}),
		// Same fight before minute 25: not counted.
		game({
			end: 1400,
			winner: 100,
			deaths: [
				[1260, 6],
				[1265, 7],
				[1270, 8],
				[1275, 9],
			],
		}),
	]);
	expect(result.bands.k21.lateFights).toEqual({
		fights: 2,
		closed: 1,
		bp: 5000,
	});
});

test("K21 nexus: the loser has three or more players dead when the nexus falls", () => {
	const result = aggregate([
		game({
			end: 1800,
			winner: 100,
			deaths: [
				[1795, 6],
				[1796, 7],
				[1797, 8],
			],
		}),
		game({ end: 1800, winner: 100, deaths: [[1795, 6]] }),
	]);
	expect(result.bands.k21.nexus).toEqual({
		games: 2,
		threeOrMore: 1,
		bp: 5000,
	});
});

test("K22 gives percentiles of death time computed from the level at death", () => {
	// Level 1 before 15:00 (10 s); player 6 reaches level 6 at 300 s (16 s).
	const levels = Array.from({ length: 10 }, (_, index) =>
		index === 5 ? [60, 120, 180, 240, 300] : [],
	);
	const result = aggregate([
		game({
			levels,
			deaths: [
				[50, 7],
				[100, 7],
				[150, 7],
				[500, 6],
			],
		}),
	]);
	expect(result.bands.k22.deaths).toBe(4);
	expect(result.bands.k22.p50).toBe(10);
	expect(result.bands.k22.p90).toBe(16);
});

test("the level curve is the median level per role and minute in tenths", () => {
	const games = Array.from({ length: 40 }, (_, index) =>
		game({
			end: 600,
			// Both tops: level 2 at 30 s, level 3 at 90 s; level 4 after minute 2
			// only in half of the games.
			levels: Array.from({ length: 10 }, (_, pid) =>
				pid === 0 || pid === 5 ? (index % 2 ? [30, 90, 110] : [30, 90, 200]) : [60],
			),
		}),
	);
	const { levelCurve } = aggregate(games);
	// Minute 1: level 2; minute 2: 3 or 4 depending on the game -> median 3.5.
	expect(levelCurve.top.slice(0, 2)).toEqual([20, 35]);
	expect(levelCurve.jungle[0]).toBe(20);
	// Games last ten minutes, so the curve stops there.
	expect(levelCurve.top).toHaveLength(10);
	expect(levelCurve.support).toHaveLength(10);
});

test("the curve stops where fewer than 30 games are left", () => {
	const longer = Array.from({ length: 29 }, () => game({ end: 1260 }));
	const shorter = Array.from({ length: 10 }, () => game({ end: 900 }));
	const { levelCurve } = aggregate([...longer, ...shorter]);
	// Minutes 1-15: 39 games; minutes 16-21: 29 games, below the threshold.
	expect(levelCurve.top).toHaveLength(15);
});

test("an empty input aggregates to zero without dividing by zero", () => {
	const { bands, levelCurve } = aggregate([]);
	expect(bands.k19.baron.moreBp).toBe(0);
	expect(bands.k22.deaths).toBe(0);
	expect(levelCurve.top).toEqual([]);
});

test("the published JSON is deterministic, small and validates", () => {
	const result = aggregate([game({ deaths: [[50, 7]] })]);
	const file = {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			licence: "CC BY-SA 3.0",
			attribution: "x",
			season: 2026,
		},
		games: { LCK: 1 },
		...result,
	};
	const a = serializeTimelines(file);
	expect(serializeTimelines(file)).toBe(a);
	expect(a.length).toBeLessThan(10_000);
	expect(a.endsWith("\n")).toBe(true);
	expect(realTimelinesSchema.parse(JSON.parse(a))).toEqual(file);
});

test("the schema rejects per-game data and unknown fields", () => {
	const file = JSON.parse(
		serializeTimelines({
			provenance: {
				source: "Leaguepedia",
				domain: "lol.fandom.com",
				licence: "CC BY-SA 3.0",
				attribution: "x",
				season: 2026,
			},
			games: { LCK: 1 },
			...aggregate([]),
		}),
	);
	expect(() =>
		realTimelinesSchema.parse({ ...file, games: [{ id: "x" }] }),
	).toThrow();
	expect(() => realTimelinesSchema.parse({ ...file, perGame: [] })).toThrow();
});

test("the real file in the repo validates and covers the five leagues without LPL", async () => {
	const text = await readFile(
		new URL("../../packages/core/content/real/timelines.json", import.meta.url),
		"utf8",
	);
	const file = realTimelinesSchema.parse(JSON.parse(text));
	expect(Object.keys(file.games).sort()).toEqual([
		"CBLOL",
		"LCK",
		"LCP",
		"LCS",
		"LEC",
	]);
	expect(text).not.toMatch(/puuid|LOLTMNT|V5 data/);
	expect(text.length).toBeLessThan(10_000);
});

test("timelines are fetched once per page, politely, and cached reduced", async () => {
	let now = 0;
	const sleeps: number[] = [];
	const urls: URL[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
		const url = new URL(String(input));
		urls.push(url);
		expect(new Headers(init?.headers).get("user-agent")).toBe(
			"RiftLegendsDataPipeline/0.1",
		);
		if (url.searchParams.get("action") === "cargoquery")
			return Response.json({
				cargoquery: [
					{
						title: {
							League: "LoL Champions Korea",
							Page: "V5 data:A/Timeline",
						},
					},
					{
						title: {
							League: "LoL Champions Korea",
							Page: "V5 data:B/Timeline",
						},
					},
					{
						title: {
							League: "LoL EMEA Championship",
							Page: "V5 data:C/Timeline",
						},
					},
				],
			});
		const title = url.searchParams.get("titles");
		if (title === "V5 data:B/Timeline")
			return Response.json({ query: { pages: { "-1": { missing: "" } } } });
		return Response.json({
			query: {
				pages: {
					"1": {
						revisions: [
							{ slots: { main: { "*": JSON.stringify(rawTimeline) } } },
						],
					},
				},
			},
		});
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
	const first = await acquireTimelines(client, 2026, "2026-11-26");
	expect(first.counts).toEqual({ LCK: 1, LEC: 1 });
	expect(first.games).toHaveLength(2);
	const pageCalls = urls.filter((u) => u.searchParams.has("titles"));
	expect(pageCalls).toHaveLength(3);
	// Page requests are spaced by at least 2 s.
	expect(Math.max(...sleeps)).toBeGreaterThanOrEqual(2000);
	const list = urls.find((u) => u.searchParams.get("action") === "cargoquery");
	expect(list?.searchParams.get("where")).toContain("T.Year='2026'");
	expect(list?.searchParams.get("where")).toContain("< '2026-11-26'");
	expect(list?.searchParams.get("where")).not.toContain("Tencent");
	// A second run is served from the cache, which holds digests, not timelines.
	await acquireTimelines(client, 2026, "2026-11-26");
	expect(fetch).toHaveBeenCalledTimes(4);
	const cached = (await import("node:fs/promises")).readdir(dir);
	for (const name of await cached) {
		const body = await readFile(join(dir, name), "utf8");
		expect(body).not.toContain("secret-player-id");
	}
});
