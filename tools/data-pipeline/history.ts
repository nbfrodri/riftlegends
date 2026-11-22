import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { mergeSamePlayers } from "./canonical-players.ts";
import type { Season } from "./career.ts";
import { type CargoRow, Client, type ClientOptions } from "./client.ts";
import { person } from "./normalization.ts";
import { compare } from "./queries.ts";
import { historySpan, season2026, snapshotSeason } from "./scope.ts";

/** Main leagues, as they were called each year (LTA, PCS, VCS and LJL included). */
export const domesticLeagues = [
	"LoL Champions Korea",
	"Tencent LoL Pro League",
	"LoL EMEA Championship",
	"League of Legends Championship Series",
	"Circuit Brazilian League of Legends",
	"League of Legends Championship Pacific",
	"Pacific Championship Series",
	"Vietnam Championship Series",
	"LoL Japan League",
	"League of Legends Championship of The Americas",
	"League of Legends Championship of The Americas North",
	"League of Legends Championship of The Americas South",
] as const;
export const internationalLeagues = [
	"World Championship",
	"Mid-Season Invitational",
	"First Stand",
] as const;
/** Regional qualifiers are filed under the Worlds league; they are not international events. */
const notInternational = /Regional Finals|Qualif/i;
const notFinal = /Regional Finals|Play-?In|Qualif/i;

const quote = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(",");

export function historyYears(
	season = snapshotSeason,
	span = historySpan,
): number[] {
	return Array.from({ length: span }, (_, index) => season - span + index);
}

const tables = "ScoreboardPlayers=SP,Tournaments=T";
const joinGames = { join_on: "SP.OverviewPage=T.OverviewPage" };
const official = (year: number) =>
	`T.Year='${year}' AND T.IsOfficial='1' AND T.TournamentLevel='Primary'`;
const cacheRow = (row: CargoRow) => ({
	...row,
	Link: row.Link ? person(row.Link).id : null,
});

/** Three aggregated queries per season: about 1 500 rows instead of a million. */
export async function acquireYear(client: Client, year: number) {
	const games = await client.cargo(
		tables,
		"SP.Link=Link,COUNT(*)=Games",
		`${official(year)} AND T.League IN (${quote(domesticLeagues)})`,
		"SP.Link",
		{ ...joinGames, group_by: "SP.Link", cacheRow },
	);
	const events = await client.cargo(
		tables,
		"SP.Link=Link,T.OverviewPage=Page",
		`${official(year)} AND T.League IN (${quote(internationalLeagues)})`,
		"SP.Link,T.OverviewPage",
		{ ...joinGames, group_by: "SP.Link,T.OverviewPage", cacheRow },
	);
	const titles = await client.cargo(
		"TournamentPlayers=TP,TournamentResults=TR,Tournaments=T",
		"TP.Link=Link,T.OverviewPage=Page,T.League=League",
		`${official(year)} AND TR.Place_Number='1' AND T.League IN (${quote([...domesticLeagues, ...internationalLeagues])}) AND (T.IsPlayoffs='1' OR T.League IN (${quote(internationalLeagues)}))`,
		"TP.Link,T.OverviewPage",
		{
			join_on:
				"TP.PageAndTeam=TR.PageAndTeam,TP.OverviewPage=T.OverviewPage",
			group_by: "TP.Link,T.OverviewPage",
			cacheRow,
		},
	);
	return { year, games, events, titles };
}
export type YearData = Awaited<ReturnType<typeof acquireYear>>;

/** Maps a Leaguepedia link to a 2026 player id (exact, then ignoring case). */
export function idResolver(ids: Iterable<string>) {
	const exact = new Set(ids);
	const folded = new Map<string, string | null>();
	for (const id of [...exact].sort(compare)) {
		const key = id.toLowerCase();
		folded.set(key, folded.has(key) ? null : id);
	}
	return (link: string) => {
		const { id } = person(link);
		return exact.has(id) ? id : (folded.get(id.toLowerCase()) ?? undefined);
	};
}

export interface PlayerHistory {
	id: string;
	seasons: Season[];
}

const count = (value: string | null | undefined) => Number(value ?? 0) || 0;

/**
 * Per player of the snapshot: one record per past season with games in a
 * main league, international events played and titles won. Ids that are not
 * in `ids` are dropped, so no other name is stored.
 */
export function buildHistory(
	years: readonly YearData[],
	ids: Iterable<string>,
): PlayerHistory[] {
	const resolve = idResolver(ids);
	const seasons = new Map<string, Map<number, Season>>();
	const entry = (link: string | null, year: number) => {
		const id = link ? resolve(link) : undefined;
		if (!id) return undefined;
		const byYear = seasons.get(id) ?? new Map<number, Season>();
		seasons.set(id, byYear);
		const season = byYear.get(year) ?? {
			year,
			games: 0,
			internationalEvents: 0,
			titles: 0,
			internationalTitles: 0,
		};
		byYear.set(year, season);
		return { id, season };
	};
	for (const { year, games, events, titles } of years) {
		for (const row of games) {
			const found = entry(row.Link ?? null, year);
			if (found) found.season.games += count(row.Games);
		}
		const played = new Set<string>();
		for (const row of events) {
			const page = row.Page ?? "";
			if (notInternational.test(page)) continue;
			// Play-In and Main Event pages are one event.
			const event = page.split("/")[0] ?? page;
			const found = entry(row.Link ?? null, year);
			if (!found || played.has(`${found.id}\u0000${event}`)) continue;
			played.add(`${found.id}\u0000${event}`);
			found.season.internationalEvents++;
		}
		const won = new Set<string>();
		for (const row of titles) {
			const page = row.Page ?? "";
			if (notFinal.test(page)) continue;
			const found = entry(row.Link ?? null, year);
			if (!found || won.has(`${found.id}\u0000${page}`)) continue;
			won.add(`${found.id}\u0000${page}`);
			if (internationalLeagues.some((league) => league === row.League))
				found.season.internationalTitles++;
			else found.season.titles++;
		}
	}
	return [...seasons]
		.map(([id, byYear]) => ({
			id,
			seasons: [...byYear.values()]
				.filter(
					(s) =>
						s.games + s.internationalEvents + s.titles + s.internationalTitles >
						0,
				)
				.sort((a, b) => a.year - b.year),
		}))
		.filter(({ seasons: list }) => list.length > 0)
		.sort((a, b) => compare(a.id, b.id));
}

export interface HistoryFile {
	provenance: {
		source: string;
		domain: string;
		retrievedAt: string;
		licence: string;
		attribution: string;
		window: { from: number; to: number };
		queries: { url: string; retrievedAt: string }[];
	};
	players: PlayerHistory[];
}

export function serializeHistory(file: HistoryFile) {
	const rows = file.players.map((row) => `\t\t${JSON.stringify(row)}`);
	return `{\n\t"provenance": ${JSON.stringify(file.provenance)},\n\t"players": ${rows.length ? `[\n${rows.join(",\n")}\n\t]` : "[]"}\n}\n`;
}

function numberField(row: Record<string, unknown>, key: string) {
	const value = row[key];
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		throw new Error(`Invalid history field: ${key}`);
	return value as number;
}

/** Reads history.json; throws on a malformed file. */
export function parseHistory(text: string): HistoryFile {
	const body = JSON.parse(text) as HistoryFile;
	if (!body || typeof body !== "object" || !Array.isArray(body.players))
		throw new Error("Invalid history file");
	for (const player of body.players) {
		if (typeof player.id !== "string" || !Array.isArray(player.seasons))
			throw new Error("Invalid history player");
		for (const season of player.seasons) {
			for (const key of [
				"year",
				"games",
				"internationalEvents",
				"titles",
				"internationalTitles",
			])
				numberField(season as unknown as Record<string, unknown>, key);
		}
	}
	return body;
}

const withoutDates = (file: HistoryFile) =>
	JSON.stringify({
		...file,
		provenance: {
			...file.provenance,
			retrievedAt: undefined,
			queries: file.provenance.queries.map(({ url }) => url),
		},
	});

/** Keeps the published bytes (and dates) when only retrieval dates changed. */
export async function preserveHistory(path: string, file: HistoryFile) {
	try {
		const existing = await readFile(path, "utf8");
		if (withoutDates(parseHistory(existing)) === withoutDates(file))
			return existing;
	} catch {
		// Missing or unreadable: write the new one.
	}
	return serializeHistory(file);
}

interface HistoryOptions extends ClientOptions {
	/** Folder with the league snapshots; history.json is written next to them. */
	outputDir: string;
	season?: number;
	span?: number;
}

/**
 * Career history of the players in the snapshot: the `span` seasons before
 * `season`. Those seasons are over, so their cached responses never expire.
 */
export async function history(options: HistoryOptions, client = new Client(options)) {
	const season = options.season ?? snapshotSeason;
	const years = historyYears(season, options.span);
	const snapshots = mergeSamePlayers(
		await Promise.all(
			season2026.map(async ({ id }) =>
				realSnapshotSchema.parse(
					JSON.parse(
						await readFile(
							join(options.outputDir, `${id.toLowerCase()}.json`),
							"utf8",
						),
					),
				),
			),
		),
	);
	const ids = snapshots.flatMap((snapshot) =>
		snapshot.seasonPlayers.map(({ id }) => id),
	);
	const data: YearData[] = [];
	for (const year of years) data.push(await acquireYear(client, year));
	const players = buildHistory(data, ids);
	const file: HistoryFile = {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: [...client.queries.values()].sort(compare).at(-1) ?? "",
			licence: "CC BY-SA 3.0",
			attribution:
				"Datos normalizados de los colaboradores de Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported.",
			window: { from: years[0] ?? season, to: years.at(-1) ?? season },
			queries: [...client.queries]
				.sort(([a], [b]) => compare(a, b))
				.map(([url, retrievedAt]) => ({ url, retrievedAt })),
		},
		players,
	};
	const path = join(options.outputDir, "history.json");
	const body = await preserveHistory(path, file);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, body);
	return { players: players.length, requests: client.queries.size, years };
}
