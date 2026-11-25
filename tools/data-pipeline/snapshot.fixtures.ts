import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { dataDragonUrl } from "./scope.ts";
import { snapshot } from "./snapshot.ts";

let directory: string;
export let cacheDir: string;
export let outputDir: string;
beforeEach(async () => {
	directory = await mkdtemp(join(tmpdir(), "rift-snapshot-"));
	cacheDir = join(directory, "raw");
	outputDir = join(directory, "real");
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

export const pointInTime = "2026-11-22T12:00:00.000Z";
export const tournament = "LCK/2026 Season/Rounds 1-2";
export const scope = [
	{ id: "LCK", name: "LoL Champions Korea", pages: [tournament] },
];
const fixture = async (name: string) =>
	JSON.parse(
		await readFile(
			new URL(`./fixtures/leaguepedia/${name}.json`, import.meta.url),
			"utf8",
		),
	);
export const cargo = (rows: Record<string, unknown>[]) => ({
	cargoquery: rows.map((title) => ({ title })),
});

export type TestRow = Record<string, string>;
export async function responses(
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
		// No wiki redirects, and a current roster with a real player per role.
		["ScoreboardPlayers=SP,PlayerRedirects=PR", cargo([])],
		["TournamentPlayers=TP,PlayerRedirects=PR", cargo([])],
		[
			"Players",
			cargo(
				[...new Set([...teamNames, "T1"])].flatMap((team) =>
					["Top", "Jungle", "Mid", "Bot", "Support"].map((role) => ({
						Link: `Synthetic ${team} ${role}`,
						Player: `Synthetic ${team} ${role}`,
						Team: team,
						Role: role,
						Retired: "0",
					})),
				),
			),
		],
		[dataDragonUrl, champions],
	]);
}

export async function seedCache(options?: Parameters<typeof responses>[0]) {
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

export async function offline() {
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
