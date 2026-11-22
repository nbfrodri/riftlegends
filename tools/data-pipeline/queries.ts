import { type CargoRow, type Client, wikiUrl } from "./client.ts";
import { person } from "./normalization.ts";
import { dataDragonUrl, type LeagueScope } from "./scope.ts";

export function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function teamKey(value: string) {
	return value.replaceAll("_", " ").toLowerCase();
}

export function inList(field: string, values: readonly string[]) {
	// Cargo rejects backslashes and SQL comments in filters. Quote values as SQL literals.
	return `${field} IN (${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",")})`;
}

function batches<T>(items: readonly T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
		items.slice(index * size, (index + 1) * size),
	);
}

const draftFields = ["Team1", "Team2"].flatMap((team) =>
	["Pick", "Ban"].flatMap((action) =>
		Array.from({ length: 5 }, (_, index) => `${team}${action}${index + 1}`),
	),
);

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Expected API object");
	return value as Record<string, unknown>;
}

function readChampions(body: unknown) {
	const data = object(object(body).data);
	const entries = Object.values(data).map((entry) => {
		const { id, name } = object(entry);
		if (typeof id !== "string" || !id || typeof name !== "string" || !name)
			throw new Error("Invalid Data Dragon champion");
		return { id, name };
	});
	if (!entries.length) throw new Error("Empty Data Dragon champion catalog");
	return entries;
}

function collectNames(rows: readonly CargoRow[], fields: readonly string[]) {
	const names = new Set<string>();
	for (const row of rows) {
		for (const field of fields) {
			const name = row[field]?.trim();
			if (name) names.add(name);
		}
	}
	return [...names].sort(compare);
}

async function readTeams(client: Client, names: string[]) {
	const teams: CargoRow[] = [];
	const redirects: CargoRow[] = [];
	const fields = "OverviewPage,Name,Short,Image";
	for (const batch of batches(names, 30)) {
		teams.push(
			...(await client.cargo(
				"Teams",
				fields,
				inList("OverviewPage", batch),
				"OverviewPage",
			)),
		);
	}
	const pages = new Set(teams.map((row) => row.OverviewPage));
	const unresolved = names.filter((name) => !pages.has(name));
	for (const batch of batches(unresolved, 30)) {
		redirects.push(
			...(await client.cargo(
				"TeamRedirects",
				"AllName,OtherName",
				inList("AllName", batch),
				"AllName,OtherName,_ID",
			)),
		);
	}
	const targets = collectNames(redirects, ["OtherName"]).filter(
		(name) => !pages.has(name),
	);
	for (const batch of batches(targets, 30)) {
		teams.push(
			...(await client.cargo(
				"Teams",
				fields,
				inList("OverviewPage", batch),
				"OverviewPage",
			)),
		);
	}
	const canonical = new Set(
		collectNames(teams, ["OverviewPage", "Name"]).map(teamKey),
	);
	const known = new Set(canonical);
	for (const { AllName, OtherName } of redirects) {
		if (AllName && OtherName && canonical.has(teamKey(OtherName)))
			known.add(teamKey(AllName));
	}
	const remaining = names.filter((name) => !known.has(teamKey(name)));
	const renames: CargoRow[] = [];
	for (const batch of batches(remaining, 30)) {
		renames.push(
			...(await client.cargo(
				"TeamRenames",
				"Date,OriginalName,NewName,IsSamePage",
				inList("OriginalName", batch),
				"Date,OriginalName,NewName,_ID",
			)),
		);
	}
	return { teams, redirects, renames };
}

export interface Logo {
	url: string;
	sha1: string;
	mime: string;
}

function imageTitle(title: string) {
	return title.replaceAll("_", " ");
}

function readImages(body: unknown, titles: string[]) {
	const result = new Map<string, Logo>();
	const query = object(object(body).query);
	const aliases = new Map<string, string>();
	for (const value of [query.normalized, query.redirects]) {
		if (!Array.isArray(value)) continue;
		for (const { from, to } of value) {
			if (typeof from === "string" && typeof to === "string")
				aliases.set(imageTitle(from), imageTitle(to));
		}
	}
	const pages = new Map<string, Logo>();
	for (const value of Object.values(object(query.pages))) {
		const { title, imageinfo } = object(value);
		if (
			typeof title !== "string" ||
			!Array.isArray(imageinfo) ||
			!imageinfo.length
		)
			continue;
		const { url, sha1, mime } = object(imageinfo[0]);
		if (
			typeof url !== "string" ||
			typeof sha1 !== "string" ||
			typeof mime !== "string"
		) {
			throw new Error(`Incomplete imageinfo: ${title}`);
		}
		pages.set(imageTitle(title), { url, sha1, mime });
	}
	for (const file of titles) {
		let title = imageTitle(`File:${file}`);
		for (let step = 0; step < aliases.size; step++) {
			const alias = aliases.get(title);
			if (!alias) break;
			title = alias;
		}
		const logo = pages.get(title);
		if (logo) result.set(file, logo);
	}
	return result;
}

export async function acquireScoreboard(
	client: Client,
	where: string,
	includeDraftData: boolean,
) {
	const scoreFields =
		"OverviewPage,GameId,DateTime_UTC,Team1,Team2,Winner,WinTeam,Gamelength";
	const lineFields =
		"GameId,GameRoleId,Link,Team,Side,Role,IngameRole,Kills,Deaths,Assists,CS,Gold,DamageToChampions,VisionScore";
	const games = await client.cargo(
		"ScoreboardGames",
		includeDraftData
			? "OverviewPage,GameId,DateTime_UTC,Team1,Team2,Winner,WinTeam,Patch,Gamelength,Team1Picks,Team2Picks,Team1Bans,Team2Bans"
			: scoreFields,
		where,
		"GameId",
	);
	const lines = await client.cargo(
		"ScoreboardPlayers",
		includeDraftData
			? "GameId,GameRoleId,Link,Name,Team,Side,Champion,Role,IngameRole,Kills,Deaths,Assists,CS,Gold,DamageToChampions,VisionScore"
			: lineFields,
		where,
		"GameId,GameRoleId",
		includeDraftData
			? {}
			: {
					cacheRow: (row) => ({
						...row,
						Link: row.Link ? person(row.Link).id : null,
					}),
				},
	);
	return { games, lines };
}

export async function acquire(client: Client, scope: readonly LeagueScope[]) {
	const where = inList(
		"OverviewPage",
		scope.flatMap((league) => league.pages),
	);
	const tournaments = await client.cargo(
		"Tournaments",
		"OverviewPage,Name,DateStart,Date",
		where,
		"OverviewPage",
	);
	const { games, lines } = await acquireScoreboard(client, where, true);
	const drafts = await client.cargo(
		"PicksAndBansS7",
		["GameId", "Team1", "Team2", "SwitchedSides", ...draftFields].join(","),
		where,
		"GameId",
	);
	const roster = await client.cargo(
		"TournamentPlayers",
		"OverviewPage,Team,Link,Player,Role",
		where,
		"PageAndTeam,N_PlayerInTeam,_ID",
	);
	const names = [
		...new Set([
			...collectNames(games, ["Team1", "Team2"]),
			...collectNames(roster, ["Team"]),
		]),
	].sort(compare);
	const { teams, redirects, renames } = await readTeams(client, names);
	const logos = new Map<string, Logo>();
	for (const titles of batches(collectNames(teams, ["Image"]), 50)) {
		const url = wikiUrl({
			action: "query",
			titles: titles.map((file) => `File:${file}`).join("|"),
			prop: "imageinfo",
			iiprop: "url|sha1|mime",
			iilimit: "1",
			redirects: "1",
		});
		const batch = await client.get(url, (body) => readImages(body, titles));
		for (const entry of batch) logos.set(...entry);
	}
	const champions = await client.get(dataDragonUrl, readChampions);
	return {
		tournaments,
		teams,
		redirects,
		renames,
		roster,
		games,
		drafts,
		lines,
		logos,
		champions,
	};
}

export type SourceData = Awaited<ReturnType<typeof acquire>>;
