import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	type InternationalMatch,
	type RealInternationals,
	realInternationalsSchema,
} from "@rift-legends/contracts/real-internationals";
import { type CargoRow, Client, type ClientOptions } from "./client.ts";
import {
	buildInternationalFormats,
	internationalFormatFiles,
} from "./international-formats.ts";
import { field, required } from "./normalization.ts";
import { compare, inList } from "./queries.ts";

/** Leaguepedia `League` of each international event, in file order. */
const events = [
	{ id: "first-stand", name: "First Stand", league: "First Stand" },
	{ id: "msi", name: "MSI", league: "Mid-Season Invitational" },
	{ id: "worlds", name: "Worlds", league: "World Championship" },
] as const;

type EventId = (typeof events)[number]["id"];

/**
 * Official tournaments of the three events in `year`. Worlds also files the
 * regional finals that qualify teams (`LPL/2026 Season/Regional Finals`)
 * under its league; those belong to the leagues, not to the event.
 */
export function selectInternationalPages(
	rows: readonly CargoRow[],
	year: number,
) {
	return rows
		.flatMap((row) => {
			const event = events.find(
				({ league }) => league === field(row, "League"),
			);
			const id = field(row, "OverviewPage");
			if (
				!event ||
				!id ||
				field(row, "Year") !== String(year) ||
				field(row, "TournamentLevel") !== "Primary" ||
				field(row, "IsOfficial") !== "1" ||
				!id.startsWith(`${year} `)
			)
				return [];
			return [
				{
					event: event.id as EventId,
					id,
					name: required(row, "Name"),
					startsOn: required(row, "DateStart"),
					endsOn: required(row, "Date"),
				},
			];
		})
		.sort(
			(a, b) =>
				events.findIndex((e) => e.id === a.event) -
					events.findIndex((e) => e.id === b.event) || compare(a.id, b.id),
		);
}

/** Orders `…_10` after `…_2`. */
const naturalOrder = (a: string, b: string) =>
	a.localeCompare(b, "en", { numeric: true });

const score = (row: CargoRow, name: string) => {
	const value = required(row, name);
	if (!/^\d+$/.test(value)) throw new Error(`Invalid ${name}: ${value}`);
	return Number(value);
};

/** Finished series of the given rows, in play order. */
export function parseMatches(rows: readonly CargoRow[]): InternationalMatch[] {
	return rows
		.map((row) => {
			const when = field(row, "DateTime_UTC") ?? required(row, "DateTime UTC");
			return {
				tournament: required(row, "OverviewPage"),
				tab: required(row, "Tab"),
				id: required(row, "MatchId"),
				date: when.slice(0, 10),
				time: when,
				team1: required(row, "Team1"),
				team2: required(row, "Team2"),
				score1: score(row, "Team1Score"),
				score2: score(row, "Team2Score"),
				bestOf: score(row, "BestOf"),
			};
		})
		.sort((a, b) => compare(a.time, b.time) || naturalOrder(a.id, b.id))
		.map(({ time: _, ...match }) => {
			const parsed =
				realInternationalsSchema.shape.events.element.shape.matches.element.safeParse(
					match,
				);
			if (!parsed.success)
				throw new Error(`Invalid series ${match.id}: ${parsed.error.message}`);
			return parsed.data;
		});
}

interface InternationalsOptions extends ClientOptions {
	outputDir: string;
}

/**
 * Fetches the three events of `season` and writes `internationals.json`
 * next to the league snapshots. Same client, rate limit and cache as the
 * snapshot.
 */
export async function internationals(
	options: InternationalsOptions,
	season: number,
	client = new Client(options),
) {
	const tournaments = selectInternationalPages(
		await client.cargo(
			"Tournaments",
			"OverviewPage,Name,League,Year,DateStart,Date,TournamentLevel,IsQualifier,IsOfficial",
			`Year='${season}' AND ${inList(
				"League",
				events.map(({ league }) => league),
			)}`,
			"OverviewPage",
		),
		season,
	);
	const rows = tournaments.length
		? await client.cargo(
				"MatchSchedule",
				"OverviewPage,MatchId,Tab,Round,N_MatchInTab,N_MatchInPage,Team1,Team2,Winner,Team1Score,Team2Score,BestOf,DateTime_UTC",
				inList(
					"OverviewPage",
					tournaments.map(({ id }) => id),
				),
				"OverviewPage,DateTime_UTC,MatchId",
			)
		: [];
	const matches = parseMatches(rows);
	for (const { id } of tournaments) {
		if (!matches.some(({ tournament }) => tournament === id))
			throw new Error(`No series for ${id}`);
	}
	const recorded = [...client.queries]
		.sort(([a], [b]) => compare(a, b))
		.map(([url, retrievedAt]) => ({ url, retrievedAt }));
	const data: RealInternationals = realInternationalsSchema.parse({
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: recorded
				.map(({ retrievedAt }) => retrievedAt)
				.sort()
				.at(-1),
			licence: "CC BY-SA 3.0",
			attribution:
				"Datos normalizados de los colaboradores de Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported.",
			queries: recorded,
		},
		season,
		events: events.flatMap(({ id, name }) => {
			const own = tournaments.filter((t) => t.event === id);
			if (!own.length) return [];
			return [
				{
					id,
					name,
					tournaments: own.map(({ id, name, startsOn, endsOn }) => ({
						id,
						name,
						startsOn,
						endsOn,
					})),
					matches: matches.filter((m) =>
						own.some((t) => t.id === m.tournament),
					),
				},
			];
		}),
	});
	await writeIfChanged(join(options.outputDir, "internationals.json"), data);
	await mkdir(join(options.outputDir, "formats"), { recursive: true });
	for (const [name, format] of Object.entries(
		internationalFormatFiles(buildInternationalFormats(data)),
	))
		await writeFile(
			join(options.outputDir, "formats", name),
			`${JSON.stringify(format, null, "\t")}\n`,
		);
	return { matches: matches.length, events: data.events.map(({ id }) => id) };
}

/** Keeps the file (and its retrieval dates) when only the dates would change. */
async function writeIfChanged(file: string, data: RealInternationals) {
	const body = `${JSON.stringify(data, null, "\t")}\n`;
	const strip = (value: RealInternationals) => {
		const { retrievedAt: _, queries, ...provenance } = value.provenance;
		return JSON.stringify({
			...value,
			provenance: { ...provenance, queries: queries.map(({ url }) => url) },
		});
	};
	const existing = await readFile(file, "utf8").catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		},
	);
	if (existing !== undefined) {
		const previous = realInternationalsSchema.safeParse(
			(() => {
				try {
					return JSON.parse(existing);
				} catch {
					return null;
				}
			})(),
		);
		if (previous.success && strip(previous.data) === strip(data)) return;
	}
	await mkdir(dirname(file), { recursive: true });
	const temp = `${file}.tmp`;
	try {
		await writeFile(temp, body);
		await rename(temp, file);
	} finally {
		await rm(temp, { force: true });
	}
}
