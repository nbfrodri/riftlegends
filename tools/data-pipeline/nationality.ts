import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { COUNTRY_CODES } from "@rift-legends/contracts/country-codes";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { mergeSamePlayers } from "./canonical-players.ts";
import { type CargoRow, Client, type ClientOptions } from "./client.ts";
import { idResolver, person } from "./normalization.ts";
import { compare } from "./queries.ts";
import { leagues } from "./scope.ts";

/** Leaguepedia names that `Intl.DisplayNames` writes differently. */
const aliases = new Map(
	Object.entries({
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
	}).map(([name, code]) => [name.toLowerCase(), code] as const),
);

const displayNames = new Intl.DisplayNames("en", {
	type: "region",
	fallback: "none",
});
const byName = new Map(
	[...COUNTRY_CODES].flatMap((code) => {
		const name = displayNames.of(code);
		return name ? [[name.toLowerCase(), code] as const] : [];
	}),
);

/** ISO 3166-1 alpha-2 code for an English country name, if it is a known one. */
export function countryCode(name: string | null | undefined) {
	const value = name?.trim();
	if (!value) return undefined;
	const code = value.toUpperCase();
	if (COUNTRY_CODES.has(code)) return code;
	return aliases.get(value.toLowerCase()) ?? byName.get(value.toLowerCase());
}

const cacheRow = (row: CargoRow) => ({
	Link: row.Link ? person(row.Link).id : null,
	Page: row.Page ? person(row.Page).id : null,
	Country: row.Country ?? null,
	NationalityPrimary: row.NationalityPrimary ?? null,
});
const quote = (values: readonly string[]) =>
	values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",");

/**
 * Country of each player seen in the given tournaments: joins to the Players
 * table by page, one row per player. A link can also be a wiki redirect
 * (`Ahn (An Shan-Ye)` for the page `Ahn`), which the direct join misses, so
 * every table is read a second time through `PlayerRedirects`.
 */
export async function acquireNationalities(
	client: Client,
	pages: readonly string[],
	/** Teams whose players were added from their current roster, with no games. */
	teams: readonly string[] = [],
) {
	const fields = (alias: string) =>
		`${alias}.Link=Link,P.OverviewPage=Page,P.Country=Country,P.NationalityPrimary=NationalityPrimary`;
	const where = (alias: string) => `${alias}.OverviewPage IN (${quote(pages)})`;
	const rows: CargoRow[] = [];
	for (const [table, alias] of [
		["ScoreboardPlayers=SP", "SP"],
		["TournamentPlayers=TP", "TP"],
	] as const) {
		for (const redirected of [false, true]) {
			rows.push(
				...(await client.cargo(
					redirected
						? `${table},PlayerRedirects=PR,Players=P`
						: `${table},Players=P`,
					fields(alias),
					where(alias),
					`${alias}.Link`,
					{
						join_on: redirected
							? `${alias}.Link=PR.AllName,PR.OverviewPage=P.OverviewPage`
							: `${alias}.Link=P.OverviewPage`,
						group_by: `${alias}.Link`,
						cacheRow,
					},
				)),
			);
		}
	}
	if (teams.length)
		rows.push(
			...(await client.cargo(
				"Players=P",
				"P.OverviewPage=Link,P.OverviewPage=Page,P.Country=Country,P.NationalityPrimary=NationalityPrimary",
				`P.Team IN (${quote(teams)})`,
				"P.OverviewPage",
				{ cacheRow },
			)),
		);
	return rows;
}

interface PlayerNationality {
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
	const found = new Map<string, { country: string; primary: boolean }>();
	const unmapped = new Set<string>();
	for (const row of rows) {
		// The player's id comes from the link the games use, or from the page
		// that link redirects to (the snapshot keeps whichever had more games).
		const id =
			(row.Link ? resolve(row.Link) : undefined) ??
			(row.Page ? resolve(row.Page) : undefined);
		if (!id) continue;
		const primary = countryCode(row.NationalityPrimary);
		const country = primary ?? countryCode(row.Country);
		if (country) {
			const previous = found.get(id);
			if (!previous || (primary && !previous.primary))
				found.set(id, { country, primary: primary !== undefined });
		} else {
			const name = row.NationalityPrimary?.trim() || row.Country?.trim();
			if (name) unmapped.add(name);
		}
	}
	return {
		players: [...found]
			.map(([id, { country }]) => ({ id, country }))
			.sort((a, b) => compare(a.id, b.id)),
		unmapped: [...unmapped].sort(compare),
	};
}

/**
 * Keeps the published country of a player the wiki momentarily has no data
 * for (a reverted edit leaves its Cargo row empty for hours). Only ids still
 * in the snapshot survive, and a fresh answer always wins.
 */
export function keepPublished(
	fresh: readonly PlayerNationality[],
	published: readonly PlayerNationality[],
	ids: Iterable<string>,
) {
	const current = new Set(ids);
	const known = new Set(fresh.map(({ id }) => id));
	return [
		...fresh,
		...published.filter(({ id }) => current.has(id) && !known.has(id)),
	].sort((a, b) => compare(a.id, b.id));
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
			!COUNTRY_CODES.has(player.country)
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
			leagues.map(async ({ id }) =>
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
		snapshots.flatMap((snapshot) => snapshot.tournaments.map(({ id }) => id)),
		snapshots.flatMap((snapshot) =>
			snapshot.teams
				.filter(({ id }) =>
					snapshot.seasonPlayers.some((row) => row.team === id && row.noGames),
				)
				.map(({ name }) => name),
		),
	);
	const found = buildNationalities(rows, ids);
	const path = join(options.outputDir, "nationalities.json");
	const published = await readFile(path, "utf8")
		.then((text) => parseNationalities(text).players)
		.catch(() => []);
	const players = keepPublished(found.players, published, ids);
	const { unmapped } = found;
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
	const body = await preserveNationalities(path, file);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, body);
	return { players: players.length, unmapped };
}
