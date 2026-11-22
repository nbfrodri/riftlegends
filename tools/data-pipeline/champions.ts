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
import { Client, type ClientOptions } from "./client.ts";
import { compare } from "./queries.ts";

// Pinned patch of the CommunityDragon catalog. Only ids, numeric keys and
// classes are read from it; names and titles never reach the repository.
const communityDragonPatch = "16.23";
export const catalogUrl = `https://raw.communitydragon.org/${communityDragonPatch}/plugins/rcp-be-lol-game-data/global/en_gb/v1/champion-summary.json`;

interface ChampionOptions extends ClientOptions {
	snapshotDir: string;
	outputDir: string;
	minimumSample?: number | undefined;
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
	const files = (await readdir(options.snapshotDir))
		.filter((file) => file.endsWith(".json"))
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
	const {
		champions,
		matchups,
		synergies,
		estimated,
		classFallbacks,
		minimumSample,
	} = deriveChampionContent(catalog, games, options.minimumSample);
	const provenance = {
		source:
			"Derived from the Leaguepedia 2026 snapshot (CC BY-SA 3.0); see real/LICENSE",
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
		games: games.length,
		minimumSample,
		counts: {
			champions: champions.length,
			matchups: matchups.length,
			synergies: synergies.length,
		},
		estimated,
		classFallbacks,
	};
	const output = new Map([
		["champions.json", rows(champions)],
		["matchups.json", rows(matchups)],
		["synergies.json", rows(synergies)],
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
	return provenance.counts;
}
