import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { mergeSamePlayers } from "./canonical-players.ts";
import { type CargoRow, Client, type ClientOptions } from "./client.ts";
import { idResolver } from "./history.ts";
import { person } from "./normalization.ts";
import { compare } from "./queries.ts";
import { season2026 } from "./scope.ts";

/** Leaguepedia names that `Intl.DisplayNames` writes differently. */
const aliases: Record<string, string> = {
	"Czech Republic": "CZ",
	Turkey: "TR",
	Macedonia: "MK",
	"North Macedonia": "MK",
	Russia: "RU",
	"Hong Kong": "HK",
	"Ivory Coast": "CI",
	"Republic of Ireland": "IE",
	Ireland: "IE",
	"United Kingdom": "GB",
	England: "GB",
	Scotland: "GB",
	Wales: "GB",
	"Northern Ireland": "GB",
	Palestine: "PS",
	"Democratic Republic of the Congo": "CD",
	"Republic of the Congo": "CG",
	Swaziland: "SZ",
	Burma: "MM",
	Serbia: "RS",
	"East Timor": "TL",
	"Cape Verde": "CV",
};

let byName: Map<string, string> | undefined;

/** ISO 3166-1 alpha-2 code for an English country name, if it is a known one. */
export function countryCode(name: string | null | undefined) {
	const value = name?.trim();
	if (!value) return undefined;
	if (!byName) {
		const names = new Intl.DisplayNames("en", { type: "region" });
		byName = new Map();
		for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
				const code = `${a}${b}`;
				const label = names.of(code);
				if (label && label !== code && !byName.has(label.toLowerCase()))
					byName.set(label.toLowerCase(), code);
			}
		}
	}
	return aliases[value] ?? byName.get(value.toLowerCase());
}

const cacheRow = (row: CargoRow) => ({
	...row,
	Link: row.Link ? person(row.Link).id : null,
});
const quote = (values: readonly string[]) =>
	values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",");

/**
 * Country of each player seen in the given tournaments: two queries that join
 * the Players table by page, one row per player.
 */
export async function acquireNationalities(
	client: Client,
	pages: readonly string[],
) {
	const fields = (alias: string) =>
		`${alias}.Link=Link,P.Country=Country,P.NationalityPrimary=NationalityPrimary`;
	const where = (alias: string) => `${alias}.OverviewPage IN (${quote(pages)})`;
	const rows: CargoRow[] = [];
	for (const [table, alias] of [
		["ScoreboardPlayers=SP", "SP"],
		["TournamentPlayers=TP", "TP"],
	] as const) {
		rows.push(
			...(await client.cargo(
				`${table},Players=P`,
				fields(alias),
				where(alias),
				`${alias}.Link`,
				{
					join_on: `${alias}.Link=P.OverviewPage`,
					group_by: `${alias}.Link`,
					cacheRow,
				},
			)),
		);
	}
	return rows;
}

export interface PlayerNationality {
	id: string;
	country: string;
}

/**
 * One ISO code per player of the snapshot. The primary nationality wins over
 * the country of residence-style `Country`; players without a known country
 * are left out. Ids outside `ids` are dropped.
 */
export function buildNationalities(
	rows: readonly CargoRow[],
	ids: Iterable<string>,
) {
	const resolve = idResolver(ids);
	const found = new Map<string, string>();
	const unmapped = new Set<string>();
	for (const row of rows) {
		const id = row.Link ? resolve(row.Link) : undefined;
		if (!id) continue;
		const name = row.NationalityPrimary?.trim() || row.Country?.trim();
		if (!name) continue;
		const code = countryCode(name);
		if (code) found.set(id, code);
		else unmapped.add(name);
	}
	return {
		players: [...found]
			.map(([id, country]) => ({ id, country }))
			.sort((a, b) => compare(a.id, b.id)),
		unmapped: [...unmapped].sort(compare),
	};
}

export interface NationalitiesFile {
	provenance: {
		source: string;
		domain: string;
		retrievedAt: string;
		licence: string;
		attribution: string;
		queries: { url: string; retrievedAt: string }[];
	};
	players: PlayerNationality[];
}

export function serializeNationalities(file: NationalitiesFile) {
	const rows = file.players.map((row) => `\t\t${JSON.stringify(row)}`);
	return `{\n\t"provenance": ${JSON.stringify(file.provenance)},\n\t"players": ${rows.length ? `[\n${rows.join(",\n")}\n\t]` : "[]"}\n}\n`;
}

/** Reads nationalities.json; throws on a malformed file. */
export function parseNationalities(text: string): NationalitiesFile {
	const body = JSON.parse(text) as NationalitiesFile;
	if (!body || typeof body !== "object" || !Array.isArray(body.players))
		throw new Error("Invalid nationalities file");
	for (const player of body.players) {
		if (typeof player.id !== "string")
			throw new Error("Invalid nationality player");
		if (
			typeof player.country !== "string" ||
			!/^[A-Z]{2}$/.test(player.country)
		)
			throw new Error(`Invalid country code for ${player.id}`);
	}
	return body;
}

const withoutDates = (file: NationalitiesFile) =>
	JSON.stringify({
		...file,
		provenance: {
			...file.provenance,
			retrievedAt: undefined,
			queries: file.provenance.queries.map(({ url }) => url),
		},
	});

/** Keeps the published bytes when only retrieval dates changed. */
export async function preserveNationalities(
	path: string,
	file: NationalitiesFile,
) {
	try {
		const existing = await readFile(path, "utf8");
		if (withoutDates(parseNationalities(existing)) === withoutDates(file))
			return existing;
	} catch {
		// Missing or unreadable: write the new one.
	}
	return serializeNationalities(file);
}

interface NationalityOptions extends ClientOptions {
	/** Folder with the league snapshots; nationalities.json is written next to them. */
	outputDir: string;
}

export async function nationalities(
	options: NationalityOptions,
	client = new Client(options),
) {
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
	const rows = await acquireNationalities(
		client,
		season2026.flatMap(({ pages }) => pages),
	);
	const { players, unmapped } = buildNationalities(rows, ids);
	const file: NationalitiesFile = {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: [...client.queries.values()].sort(compare).at(-1) ?? "",
			licence: "CC BY-SA 3.0",
			attribution:
				"Datos normalizados de los colaboradores de Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported.",
			queries: [...client.queries]
				.sort(([a], [b]) => compare(a, b))
				.map(([url, retrievedAt]) => ({ url, retrievedAt })),
		},
		players,
	};
	const path = join(options.outputDir, "nationalities.json");
	const body = await preserveNationalities(path, file);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, body);
	return { players: players.length, unmapped };
}
