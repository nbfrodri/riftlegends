import { randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	type RealSnapshot,
	realSnapshotSchema,
} from "@rift-legends/contracts/real-snapshot";
import {
	type CatalogChampion,
	deriveChampionContent,
} from "./champion-content.ts";
import { championHistory } from "./champion-history.ts";
import { fetchKits } from "./champion-kit-fetch.ts";
import { Client, type ClientOptions } from "./client.ts";
import { orderBy } from "./normalization.ts";
import { compare } from "./queries.ts";
import { leagues } from "./scope.ts";
import { seasonOf } from "./season.ts";

// Pinned patch of the CommunityDragon catalog. Only ids, numeric keys and
// classes are read from it; names and titles never reach the repository.
export const communityDragonPatch = "16.23";
export const catalogUrl = `https://raw.communitydragon.org/${communityDragonPatch}/plugins/rcp-be-lol-game-data/global/en_gb/v1/champion-summary.json`;

interface ChampionOptions extends ClientOptions {
	snapshotDir: string;
	outputDir: string;
	priorGames?: number | undefined;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Invalid champion summary entry");
	return value as Record<string, unknown>;
}

export function readCatalog(body: unknown): CatalogChampion[] {
	if (!Array.isArray(body) || !body.length)
		throw new Error("Invalid champion summary");
	const champions: CatalogChampion[] = [];
	for (const item of body) {
		const { id, alias, roles } = record(item);
		if (
			typeof id !== "number" ||
			!Number.isInteger(id) ||
			typeof alias !== "string"
		)
			throw new Error("Invalid champion summary entry");
		// "None" (-1) and the Jade variants (60000 range) are not playable.
		if (id < 1 || id >= 60000 || !Array.isArray(roles) || !roles.length)
			continue;
		if (!/^[A-Za-z][A-Za-z0-9]*$/.test(alias))
			throw new Error(`Invalid champion alias: ${alias}`);
		champions.push({
			id: alias,
			key: id,
			classes: roles.filter((role): role is string => typeof role === "string"),
		});
	}
	return champions.sort((a, b) => a.key - b.key);
}

const rows = (values: readonly unknown[]) =>
	values.length
		? `[\n${values.map((row) => `\t${JSON.stringify(row)}`).join(",\n")}\n]\n`
		: "[]\n";

export async function championFiles(options: ChampionOptions) {
	const client = new Client(options);
	const catalog = await client.get(catalogUrl, readCatalog);
	const leagueFiles = new Set(
		leagues.map(({ id }) => `${id.toLowerCase()}.json`),
	);
	const files = (await readdir(options.snapshotDir))
		.filter((file) => leagueFiles.has(file))
		.sort(compare);
	const snapshots: RealSnapshot[] = [];
	for (const file of files) {
		snapshots.push(
			realSnapshotSchema.parse(
				JSON.parse(await readFile(join(options.snapshotDir, file), "utf8")),
			),
		);
	}
	const games = snapshots.flatMap((snapshot) => snapshot.games);
	const season = seasonOf(snapshots);
	if (!season) throw new Error("Cannot determine the season of the snapshot");
	let picks = 0;
	let bans = 0;
	for (const game of games) {
		if (Number(game.date.slice(0, 4)) !== season) continue;
		for (const team of game.teams) {
			picks += team.picks.filter(Boolean).length;
			bans += team.bans.filter(Boolean).length;
		}
	}
	const history = await championHistory(
		client.withCache(join(options.cacheDir, "history")),
		catalog,
		season,
		picks ? bans / picks : 0,
	);
	const {
		kits,
		missing: missingKits,
		...kitSource
	} = await fetchKits(
		client.withCache(join(options.cacheDir, "kits")),
		communityDragonPatch,
		catalog.map(({ id }) => id),
	);
	const tierSeasons = {
		current: season,
		available: [season, ...history.seasons.map(({ year }) => year)],
		missing: history.missing,
	};
	const {
		champions,
		matchups,
		counters,
		synergies,
		estimated,
		classFallbacks,
		priorGames,
		traits,
	} = deriveChampionContent(catalog, games, {
		priorGames: options.priorGames,
		season,
		history: history.seasons,
		kits,
	});
	const provenance = {
		source: `Derived from champion kit profiles and Leaguepedia (CC BY-SA 3.0); see real/LICENSE`,
		catalog: {
			url: catalogUrl,
			retrievedAt: client.queries.get(catalogUrl),
			patch: communityDragonPatch,
			champions: catalog.length,
		},
		snapshot: {
			files,
			retrievedAt: snapshots
				.map((s) => s.provenance.retrievedAt)
				.sort(compare)
				.at(-1),
			licence: snapshots[0]?.provenance.licence,
			attribution: snapshots[0]?.provenance.attribution,
		},
		kits: {
			source:
				"CommunityDragon game data (characters bin files and the official string table)",
			patch: communityDragonPatch,
			url: kitSource.url,
			retrievedAt: kitSource.retrievedAt,
			champions: kits.size,
			missing: missingKits,
			// No ultimate cooldown in the game data (zero or scripted).
			noUltimateCooldown: [...kits.values()]
				.filter(({ ultCooldown }) => !ultCooldown)
				.map(({ id }) => id),
		},
		// Champions whose data-decidable traits include an estimate. Frontline,
		// power and archetypes are always estimates and not listed here.
		traitsToReview: traits
			.filter(({ sources: { frontline, power, archetypes, ...decidable } }) =>
				Object.values(decidable).includes("estimated"),
			)
			.map(({ id }) => id),
		games: games.length,
		priorGames,
		tierSeasons,
		counts: {
			champions: champions.length,
			matchups: matchups.length,
			counters: counters.length,
			synergies: synergies.length,
		},
		estimated,
		classFallbacks,
	};
	const output = new Map([
		["champions.json", rows(champions)],
		["matchups.json", rows(matchups)],
		["counters.json", rows(counters)],
		["synergies.json", rows(synergies)],
		["kits.json", rows(orderBy([...kits.values()], ({ id }) => id))],
		["traits.json", rows(traits)],
		["provenance.json", `${JSON.stringify(provenance, null, "\t")}\n`],
	]);
	const staging = join(
		dirname(options.outputDir),
		`.champions-${randomUUID()}`,
	);
	await mkdir(staging, { recursive: true });
	try {
		for (const [file, body] of output)
			await writeFile(join(staging, file), body);
		await mkdir(options.outputDir, { recursive: true });
		for (const file of output.keys())
			await rename(join(staging, file), join(options.outputDir, file));
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
	return { counts: provenance.counts, missingSeasons: history.missing };
}
