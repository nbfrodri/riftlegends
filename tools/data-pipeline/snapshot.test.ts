import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cacheFile } from "./client.ts";
import { dataDragonUrl, season2026 } from "./scope.ts";
import { snapshot } from "./snapshot.ts";

let directory: string;
let cacheDir: string;
let outputDir: string;
beforeEach(async () => {
	directory = await mkdtemp(join(tmpdir(), "rift-snapshot-"));
	cacheDir = join(directory, "raw");
	outputDir = join(directory, "real");
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

const pointInTime = "2026-11-22T12:00:00.000Z";
const tournament = "LCK/2026 Season/Rounds 1-2";
const scope = [{ id: "LCK", name: "LoL Champions Korea", pages: [tournament] }];
const fixture = async (name: string) =>
	JSON.parse(
		await readFile(
			new URL(`./fixtures/leaguepedia/${name}.json`, import.meta.url),
			"utf8",
		),
	);
const cargo = (rows: Record<string, unknown>[]) => ({
	cargoquery: rows.map((title) => ({ title })),
});

type TestRow = Record<string, string>;
async function responses(
	options: {
		transfer?: "later" | "earlier" | "tie";
		unknownChampion?: boolean;
		orphanDraft?: boolean;
		renamedTeam?: boolean;
	} = {},
) {
	const games = await fixture("games");
	const players = await fixture("players");
	const drafts = await fixture("draft");
	const teams = await fixture("team");
	const recordedRoster = (await fixture("roster")).cargoquery[0]
		.title as TestRow;
	const tournaments = await fixture("tournaments-six-leagues");
	const images = await fixture("logo-imageinfo");
	// Synthetic supplements for fields and teams absent from the recorded sample.
	images.query.pages["470308"].imageinfo[0].sha1 = "c".repeat(40);
	const teamNames = new Set<string>();
	const championNames = new Set<string>();
	for (const { title } of games.cargoquery as { title: TestRow }[]) {
		for (const name of [title.Team1, title.Team2])
			if (name) teamNames.add(name);
		for (const field of [
			"Team1Picks",
			"Team2Picks",
			"Team1Bans",
			"Team2Bans",
		]) {
			for (const champion of title[field]?.split(",") ?? [])
				championNames.add(champion);
		}
	}
	const ids: Record<string, string> = {
		Wukong: "MonkeyKing",
		"Jarvan IV": "JarvanIV",
	};
	championNames.add("Wukong");
	const champions = {
		data: Object.fromEntries(
			[...championNames].map((name) => {
				const id = ids[name] ?? name.replaceAll(/[^a-zA-Z]/g, "");
				return [id, { id, name }];
			}),
		),
	};
	const rosters = cargo([
		...(recordedRoster.RosterLinks?.split(";;") ?? []).map((link, index) => ({
			OverviewPage: tournament,
			Team: "T1",
			Link: link,
			Player: link.replace(/\s+\([^()]+\)$/, ""),
			Role: recordedRoster.Roles?.split(";;")[index],
		})),
		{
			OverviewPage: tournament,
			Team: "T1",
			Link: "SyntheticCoach (Private Placeholder)",
			Player: "SyntheticCoach",
			Role: "Coach",
		},
		{
			OverviewPage: tournament,
			Team: "T1",
			Link: "SyntheticNoGames",
			Player: "SyntheticNoGames",
			Role: "Coach,Top",
		},
	]);
	if (options.transfer) {
		if (options.transfer === "earlier")
			games.cargoquery[1].title["DateTime UTC"] = "2026-04-01 07:00:00";
		if (options.transfer === "tie")
			games.cargoquery[1].title["DateTime UTC"] =
				games.cargoquery[0].title["DateTime UTC"];
		const first = players.cargoquery[0].title;
		const second = players.cargoquery[10].title;
		// Second game swaps the teams in the scoreboard. The player swaps teams too.
		second.Link = first.Link;
		second.Name = first.Name;
		const replacement = players.cargoquery
			.slice(10, 20)
			.find(
				({ title }: { title: TestRow }) =>
					title.Team === first.Team && title.Role === first.Role,
			).title;
		replacement.Link = "SyntheticReplacement";
		replacement.Name = "SyntheticReplacement";
		rosters.cargoquery.push(
			...cargo([
				{
					OverviewPage: tournament,
					Team: first.Team,
					Link: first.Link,
					Player: first.Name,
					Role: "Top",
				},
				{
					OverviewPage: tournament,
					Team: second.Team,
					Link: second.Link,
					Player: second.Name,
					Role: "Top",
				},
			]).cargoquery,
		);
	}
	players.cargoquery[0].title.VisionScore = "";
	drafts.cargoquery[0].title.Team1Ban1 = "Wukong";
	drafts.cargoquery[0].title.Team1Ban2 = "None";
	if (options.orphanDraft) {
		drafts.cargoquery.push({
			title: {
				...drafts.cargoquery[0].title,
				GameId: "Synthetic Draft Without Scoreboard",
			},
		});
	}
	if (options.renamedTeam) {
		rosters.cargoquery.push(
			...cargo([
				{
					OverviewPage: tournament,
					Team: "Synthetic Old BRION",
					Link: "Synthetic Alias Coach",
					Player: "Synthetic Alias Coach",
					Role: "Coach",
				},
			]).cargoquery,
		);
	}
	if (options.unknownChampion) {
		players.cargoquery[0].title.Champion = "Synthetic Unknown 1";
		players.cargoquery[1].title.Champion = "Synthetic Unknown 2";
	}
	return new Map<string, unknown>([
		[
			"Tournaments",
			{
				...tournaments,
				cargoquery: tournaments.cargoquery.filter(
					({ title }: { title: TestRow }) => title.OverviewPage === tournament,
				),
			},
		],
		["ScoreboardGames", games],
		["ScoreboardPlayers", players],
		["PicksAndBansS7", drafts],
		["TournamentPlayers", rosters],
		[
			"Teams",
			{
				cargoquery: [
					...teams.cargoquery,
					...cargo(
						[...teamNames]
							.filter((name) => name !== "T1")
							.map((name) => ({ OverviewPage: name, Name: name, Short: name })),
					).cargoquery,
				],
			},
		],
		["query", images],
		[
			"TeamRedirects",
			cargo([{ AllName: "Synthetic Old BRION", OtherName: "" }]),
		],
		[
			"TeamRenames",
			cargo([
				{
					OriginalName: "Synthetic Old BRION",
					NewName: "HANJIN BRION",
					IsSamePage: "Yes",
					Date: "2026-01-01 00:00:00",
				},
				{
					OriginalName: "Synthetic Old BRION",
					NewName: "KT Rolster",
					IsSamePage: "Yes",
					Date: "2023-01-01 00:00:00",
				},
			]),
		],
		[dataDragonUrl, champions],
	]);
}

async function seedCache(options?: Parameters<typeof responses>[0]) {
	const bodies = await responses(options);
	let now = Date.parse(pointInTime);
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		const url = new URL(String(input));
		const key =
			url.searchParams.get("tables") ??
			url.searchParams.get("action") ??
			url.href;
		const body = bodies.get(key);
		if (!body) throw new Error(`Unexpected query: ${url}`);
		return Response.json(body);
	});
	await snapshot({
		cacheDir,
		outputDir,
		scope,
		fetch,
		now: () => now,
		sleep: async (ms) => {
			now += ms;
		},
	});
	await rm(outputDir, { recursive: true, force: true });
}

async function offline() {
	const fetch = vi.fn<typeof globalThis.fetch>(() => {
		throw new Error("Network access in offline mode");
	});
	await snapshot({
		cacheDir,
		outputDir,
		scope,
		offline: true,
		fetch,
		now: () => Date.parse("2030-01-01"),
	});
	expect(fetch).not.toHaveBeenCalled();
	return readFile(join(outputDir, "lck.json"), "utf8");
}

it("P1 regenerates identical bytes offline from recorded responses, with stable key and row order", async () => {
	await seedCache();
	const first = await offline();
	// Reordering object fields and rows in the cache has no effect on the output.
	for (const file of await readdir(cacheDir)) {
		const path = join(cacheDir, file);
		const entry = JSON.parse(await readFile(path, "utf8"));
		if (entry.body.cargoquery) {
			entry.body.cargoquery.reverse();
			for (const item of entry.body.cargoquery)
				item.title = Object.fromEntries(Object.entries(item.title).reverse());
			await writeFile(path, JSON.stringify(entry));
		}
	}
	expect(await offline()).toBe(first);
	const { league, provenance, teams, games } = JSON.parse(first);
	expect(Object.keys(JSON.parse(first))).toEqual([
		"provenance",
		"league",
		"tournaments",
		"teams",
		"rosters",
		"seasonPlayers",
		"games",
	]);
	expect(league.id).toBe("LCK");
	expect(
		provenance.queries.find(({ url }: { url: string }) =>
			url.includes("tables=Tournaments"),
		).retrievedAt,
	).toBe(pointInTime);
	expect(teams.map(({ id }: { id: string }) => id)).toEqual(
		teams.map(({ id }: { id: string }) => id).sort(),
	);
	expect(teams.find(({ id }: { id: string }) => id === "T1").logo.sha1).toBe(
		"c".repeat(40),
	);
	const firstGame = games[0];
	expect(firstGame.lengthSeconds).toBe(1927);
	expect(
		firstGame.teams.find(({ id }: { id: string }) => id === "HANJIN BRION"),
	).toMatchObject({
		side: "blue",
		picks: ["Neeko", "JarvanIV", "Cassiopeia", "Jhin", "Yorick"],
	});
	expect(firstGame.teams[1].bans.slice(0, 2)).toEqual(["MonkeyKing", null]);
	expect(
		firstGame.lines.find(
			({ player }: { player: string }) => player === "Casting",
		).visionScore,
	).toBeUndefined();
	expect(first).toContain("MonkeyKing");
	expect(first).not.toContain("Private Placeholder");
});

it("P2 aborts after N failures without touching a previous snapshot", async () => {
	await mkdir(outputDir);
	const previous = join(outputDir, "lck.json");
	await writeFile(previous, "previous bytes");
	let now = 0;
	const fetch = vi.fn<typeof globalThis.fetch>(async () =>
		Response.json({ error: { code: "maxlag" } }),
	);
	await expect(
		snapshot({
			cacheDir,
			outputDir,
			scope,
			fetch,
			maxAttempts: 3,
			now: () => now,
			sleep: async (ms) => {
				now += ms;
			},
		}),
	).rejects.toThrow("maxlag");
	expect(fetch).toHaveBeenCalledTimes(3);
	expect(await readdir(outputDir)).toEqual(["lck.json"]);
	expect(await readFile(previous, "utf8")).toBe("previous bytes");
});

it("P3 requires provenance even when all the data are valid", async () => {
	await seedCache();
	const valid = JSON.parse(await offline());
	expect(realSnapshotSchema.safeParse(valid).success).toBe(true);
	delete valid.provenance;
	expect(realSnapshotSchema.safeParse(valid).success).toBe(false);
});

it("reports a draft-only source row without creating a scoreboard game", async () => {
	await seedCache({ orphanDraft: true });
	const data = realSnapshotSchema.parse(JSON.parse(await offline()));
	expect(data.games).toHaveLength(3);
	const { oddities } = await snapshot({
		cacheDir,
		outputDir,
		scope,
		offline: true,
	});
	expect(oddities).toMatchObject({ orphanDrafts: 1, missingDraft: 0 });
});

it("resolves an old roster team through the latest same-page rename", async () => {
	await seedCache({ renamedTeam: true });
	const data = realSnapshotSchema.parse(JSON.parse(await offline()));
	expect(
		data.rosters.find(({ team }) => team === "HANJIN BRION")?.coaches,
	).toContainEqual({
		id: "Synthetic Alias Coach",
		name: "Synthetic Alias Coach",
		role: "Coach",
	});
});

it.each([
	["later", "Hanwha Life Esports"],
	["earlier", "HANJIN BRION"],
	["tie", "Hanwha Life Esports"],
] as const)(
	"P4 picks the last team with a %s game date and keeps roster flags",
	async (transfer, team) => {
		await seedCache({ transfer });
		const { seasonPlayers, rosters } = JSON.parse(await offline());
		expect(
			seasonPlayers.filter(({ id }: { id: string }) => id === "Casting"),
		).toMatchObject([{ id: "Casting", team, role: "top", sub: true }]);
		expect(seasonPlayers).toContainEqual({
			id: "SyntheticNoGames",
			name: "SyntheticNoGames",
			role: "top",
			team: "T1",
			sub: true,
			noGames: true,
		});
		expect(
			rosters.find(({ team }: { team: string }) => team === "T1").coaches,
		).toContainEqual({
			id: "SyntheticNoGames",
			name: "SyntheticNoGames",
			role: "Coach",
		});
		expect(
			seasonPlayers.find(({ id }: { id: string }) => id === "GIDEON").sub,
		).toBe(false);
		expect(
			rosters.find(({ team }: { team: string }) => team === "HANJIN BRION")
				.players,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "Casting", sub: true }),
			]),
		);
	},
);

it("lists all unmapped champion names before writing any file", async () => {
	const bodies = await responses({ unknownChampion: true });
	let now = 0;
	await expect(
		snapshot({
			cacheDir,
			outputDir,
			scope,
			fetch: async (input) => {
				const url = new URL(String(input));
				return Response.json(
					bodies.get(
						url.searchParams.get("tables") ??
							url.searchParams.get("action") ??
							url.href,
					),
				);
			},
			now: () => now,
			sleep: async (ms) => {
				now += ms;
			},
		}),
	).rejects.toThrow("Synthetic Unknown 1, Synthetic Unknown 2");
	await expect(readdir(outputDir)).rejects.toMatchObject({ code: "ENOENT" });
});

it("P1 selects only the 33 named main competition tournaments", async () => {
	const pages = season2026.flatMap((league) => league.pages);
	const counts = await fixture("games-by-tournament");
	const recorded = new Set(
		counts.cargoquery.map(
			({ title }: { title: TestRow }) => title.OverviewPage,
		),
	);
	expect(season2026.map(({ id }) => id)).toEqual([
		"LCK",
		"LPL",
		"LEC",
		"LCP",
		"LCS",
		"CBLOL",
	]);
	expect(pages).toHaveLength(33);
	expect(new Set(pages).size).toBe(33);
	expect(pages.every((page) => recorded.has(page))).toBe(true);
	expect(pages.join("\n")).not.toMatch(
		/Showmatch|Promotion|Opening|Regional Finals/,
	);
});

it("reports an offline cache miss and preserves a previously written file", async () => {
	await seedCache();
	const first = await offline();
	await rm(cacheFile(cacheDir, dataDragonUrl));
	await expect(offline()).rejects.toThrow("Offline cache miss");
	expect(await readFile(join(outputDir, "lck.json"), "utf8")).toBe(first);
});
