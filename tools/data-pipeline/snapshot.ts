import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	type RealSnapshot,
	realSnapshotSchema,
} from "@rift-legends/contracts/real-snapshot";
import { mergeSamePlayers } from "./canonical-players.ts";
import { Client, type ClientOptions } from "./client.ts";
import { normalizeGames } from "./games.ts";
import {
	championResolver,
	field,
	indexBy,
	orderBy,
	required,
	teamResolver,
} from "./normalization.ts";
import {
	acquire,
	acquireScoreboard,
	compare,
	inList,
	teamKey,
} from "./queries.ts";
import { normalizeRosters } from "./rosters.ts";
import { dataDragonVersion, type LeagueScope } from "./scope.ts";
import { discoverSeason } from "./season.ts";

interface SnapshotOptions extends ClientOptions {
	outputDir: string;
	scope?: readonly LeagueScope[];
}

function serialize(snapshot: RealSnapshot) {
	// Keep each game and its statistics on one line for compact diffs.
	const blocks = Object.entries(snapshot).map(([key, value]) => {
		const rows = Array.isArray(value) ? value : null;
		const body = rows?.length
			? `[\n${rows.map((row) => `\t\t${JSON.stringify(row)}`).join(",\n")}\n\t]`
			: JSON.stringify(value);
		return `\t"${key}": ${body}`;
	});
	return `{\n${blocks.join(",\n")}\n}\n`;
}

function withoutRetrievalDates(snapshot: RealSnapshot) {
	const { retrievedAt: _, queries, ...provenance } = snapshot.provenance;
	return JSON.stringify({
		...snapshot,
		provenance: { ...provenance, queries: queries.map(({ url }) => url) },
	});
}

async function preserveUnchanged(file: string, snapshot: RealSnapshot) {
	const existing = await readFile(file, "utf8").catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		},
	);
	if (existing === undefined) return serialize(snapshot);
	try {
		const previous = realSnapshotSchema.safeParse(JSON.parse(existing));
		if (
			previous.success &&
			withoutRetrievalDates(previous.data) === withoutRetrievalDates(snapshot)
		)
			return existing;
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
	}
	return serialize(snapshot);
}

async function publish(outputDir: string, files: ReadonlyMap<string, string>) {
	const staging = join(dirname(outputDir), `.real-${randomUUID()}`);
	await mkdir(staging, { recursive: true });
	try {
		for (const [file, body] of files)
			await writeFile(join(staging, file), body);
		await mkdir(outputDir, { recursive: true });
		for (const file of files.keys())
			await rename(join(staging, file), join(outputDir, file));
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

export async function snapshot(
	options: SnapshotOptions,
	client = new Client(options),
	closedSeasons = client.withCache(join(options.cacheDir, "history")),
) {
	const discovered = options.scope
		? undefined
		: await discoverSeason(
				client,
				new Date(options.now?.() ?? Date.now()),
				undefined,
				closedSeasons,
			);
	const scope = options.scope ?? discovered?.scope ?? [];
	const missing = scope.filter(({ pages }) => pages.length === 0);
	if (!scope.length || missing.length)
		throw new Error(
			`No played tournaments for the snapshot scope: ${missing.map(({ id }) => id).join(", ")}`,
		);
	const source = await acquire(client, scope);
	const { pages, resolve } = teamResolver(source);
	const champions = championResolver(source);
	const {
		games,
		people,
		oddities: gameOddities,
	} = normalizeGames(source, resolve, champions.find);
	champions.check();
	const tournaments = indexBy(
		source.tournaments.map((row) => ({
			id: required(row, "OverviewPage"),
			name: required(row, "Name"),
			startsOn: field(row, "DateStart"),
			endsOn: field(row, "Date"),
		})),
		(row) => row.id,
		"tournament",
	);
	const {
		rosters,
		seasonPlayers,
		oddities: rosterOddities,
	} = normalizeRosters(source, games, people, tournaments, resolve);
	const pastGames = new Map<string, RealSnapshot["games"]>();
	for (const { id, previousPages } of scope) {
		if (!previousPages?.length) continue;
		const scoreboard = await acquireScoreboard(
			closedSeasons,
			inList("OverviewPage", previousPages),
			false,
		);
		const { games } = normalizeGames(
			{ ...scoreboard, drafts: [] },
			teamKey,
			() => undefined,
		);
		pastGames.set(id, games);
	}
	const recorded = new Map([...client.queries, ...closedSeasons.queries]);
	const queries = [...recorded]
		.sort(([a], [b]) => compare(a, b))
		.map(([url, retrievedAt]) => ({ url, retrievedAt }));
	const provenance = {
		source: "Leaguepedia",
		domain: "lol.fandom.com",
		retrievedAt: [...recorded.values()].sort().at(-1),
		licence: "CC BY-SA 3.0",
		attribution:
			"Datos normalizados de los colaboradores de Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported.",
		dataDragonVersion,
		queries,
	};
	let missingLogos = 0;
	const built: RealSnapshot[] = [];
	for (const league of scope) {
		const selected = new Set(league.pages);
		const previousGames = pastGames.get(league.id);
		const leagueGames = games.filter((game) => selected.has(game.tournament));
		const leagueRosters = rosters.filter((row) => selected.has(row.tournament));
		const teams = [...new Set(leagueRosters.map(({ team }) => team))]
			.sort(compare)
			.map((id) => {
				const row = pages.get(id);
				if (!row) throw new Error(`Missing team page: ${id}`);
				const file = field(row, "Image");
				const logo = file && source.logos.get(file);
				if (!logo) missingLogos++;
				return {
					id,
					name: required(row, "Name"),
					short: field(row, "Short"),
					league: league.id,
					logo: logo ? { file, ...logo } : undefined,
				};
			});
		const validated = realSnapshotSchema.parse({
			provenance,
			...(discovered ? { season: discovered.season } : {}),
			league: { id: league.id, name: league.name },
			tournaments: [...selected].sort(compare).map((id) => {
				const row = tournaments.get(id);
				if (!row || !leagueGames.some((game) => game.tournament === id))
					throw new Error(`Missing tournament or games: ${id}`);
				return row;
			}),
			teams,
			rosters: leagueRosters,
			seasonPlayers: orderBy(
				league.pages.flatMap((page) => seasonPlayers.get(page) ?? []),
				(row) => row.id,
			),
			games: leagueGames,
			...(previousGames?.length ? { previousGames } : {}),
		});
		built.push(validated);
	}
	const files = new Map<string, string>();
	const totals = [];
	for (const validated of mergeSamePlayers(built)) {
		const file = `${validated.league.id.toLowerCase()}.json`;
		files.set(
			file,
			await preserveUnchanged(
				join(options.outputDir, file),
				realSnapshotSchema.parse(validated),
			),
		);
		totals.push({
			league: validated.league.id,
			teams: validated.teams.length,
			players: validated.seasonPlayers.length,
			coaches: new Set(
				validated.rosters.flatMap((row) =>
					row.coaches.map((coach) => coach.id),
				),
			).size,
			games: validated.games.length,
		});
	}
	await publish(options.outputDir, files);
	return {
		totals,
		oddities: { ...gameOddities, ...rosterOddities, missingLogos },
		bytes: Buffer.byteLength([...files.values()].join("")),
	};
}
