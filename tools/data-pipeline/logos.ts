import { randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
	parseRiotLogoUrl,
	type RealLogo,
	type RealLogos,
	realLogosSchema,
} from "@rift-legends/contracts/real-logos";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { Client, type ClientOptions, lolesportsApi } from "./client.ts";
import { compare } from "./queries.ts";
import { leagues } from "./scope.ts";

/**
 * Team logo sources for the real snapshot, from the public lolesports.com web
 * API (authorised by the user on 2026-11-22). Dev/CI only: the app never calls
 * this API, it only downloads the Riot images this step lists.
 */
export const teamsUrl = `${lolesportsApi}/getTeams?hl=en-US`;

/** Snapshot team id to lolesports team slug, for names and codes that differ. */
const aliases: Readonly<Record<string, string>> = {
	"Team Liquid": "team-liquid",
};

export interface SnapshotTeam {
	id: string;
	name: string;
	short?: string | undefined;
	league: string;
}

export interface ApiTeam {
	slug: string;
	name: string;
	code: string;
	image: string | null;
	status: string;
	homeLeague: { name: string } | null;
	players: ApiPlayer[];
}

interface ApiPlayer {
	handle: string;
	image: string | null;
}

export interface Unmatched {
	team: string;
	league: string;
	reason: string;
}

export function parseApiTeams(body: unknown): ApiTeam[] {
	const teams = (body as { data?: { teams?: unknown } } | null)?.data?.teams;
	if (!Array.isArray(teams)) throw new Error("Invalid lolesports teams");
	return teams.map((team) => {
		const { slug, name, code, image, status, homeLeague, players } = team ?? {};
		if (
			typeof slug !== "string" ||
			typeof name !== "string" ||
			typeof code !== "string" ||
			typeof status !== "string" ||
			(image != null && typeof image !== "string") ||
			(homeLeague != null && typeof homeLeague?.name !== "string")
		)
			throw new Error("Invalid lolesports team");
		return {
			slug,
			name,
			code,
			image: image ?? null,
			status,
			homeLeague: homeLeague ? { name: homeLeague.name } : null,
			players: Array.isArray(players)
				? players.flatMap((player) => {
						const { summonerName, image } = player ?? {};
						return typeof summonerName === "string" && summonerName
							? [
									{
										handle: summonerName,
										image: typeof image === "string" ? image : null,
									},
								]
							: [];
					})
				: [],
		};
	});
}

const fold = (text: string) =>
	text
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

/**
 * The lolesports team of a snapshot team: the explicit alias, or the team of
 * the same league with the same code or name (active ones first). Several
 * candidates left means no match, never a guess.
 */
export function matchTeam(
	team: SnapshotTeam,
	apiTeams: readonly ApiTeam[],
): ApiTeam | string {
	const alias = Object.hasOwn(aliases, team.id) ? aliases[team.id] : undefined;
	if (alias) {
		const matches = apiTeams.filter(({ slug }) => slug === alias);
		return matches.length > 1
			? "ambiguous"
			: (matches[0] ?? `no team "${alias}"`);
	}
	const league = fold(team.league);
	const sameLeague = apiTeams.filter(
		({ homeLeague }) => homeLeague && fold(homeLeague.name) === league,
	);
	const byCode = (candidate: ApiTeam) =>
		team.short !== undefined && fold(candidate.code) === fold(team.short);
	const byName = (candidate: ApiTeam) =>
		fold(candidate.name) === fold(team.name);
	for (const same of [byCode, byName]) {
		const found = sameLeague.filter(same);
		const active = found.filter(({ status }) => status === "active");
		const pool = active.length ? active : found;
		if (pool.length === 1 && pool[0]) return pool[0];
		if (pool.length > 1) return "ambiguous";
	}
	return "no team in the league";
}

export const httpsOf = (image: string) =>
	image.replace(/^http:\/\//i, "https://");

export async function buildLogos(
	client: Client,
	teams: readonly SnapshotTeam[],
): Promise<{ logos: RealLogo[]; unmatched: Unmatched[]; retrievedAt: string }> {
	const apiTeams = await client.get(teamsUrl, parseApiTeams);
	const retrievedAt = client.queries.get(teamsUrl) as string;
	const logos: RealLogo[] = [];
	const unmatched: Unmatched[] = [];
	for (const team of [...teams].sort((a, b) => compare(a.id, b.id))) {
		const fail = (reason: string) =>
			unmatched.push({ team: team.id, league: team.league, reason });
		const match = matchTeam(team, apiTeams);
		if (typeof match === "string") {
			fail(match);
			continue;
		}
		const url = match.image && parseRiotLogoUrl(httpsOf(match.image));
		if (!url) {
			fail("no usable logo URL");
			continue;
		}
		try {
			const digest = await client.imageDigest(url.href);
			logos.push({ team: team.id, url: url.href, ...digest } as RealLogo);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	}
	return { logos, unmatched, retrievedAt };
}

const logosFile = "logos.json";

async function readTeams(outputDir: string): Promise<SnapshotTeam[]> {
	const leagueFiles = new Set(
		leagues.map(({ id }) => `${id.toLowerCase()}.json`),
	);
	const files = (await readdir(outputDir))
		.filter((file) => leagueFiles.has(file))
		.sort();
	const teams: SnapshotTeam[] = [];
	for (const file of files) {
		const snapshot = realSnapshotSchema.parse(
			JSON.parse(await readFile(join(outputDir, file), "utf8")),
		);
		for (const { id, name, short, league } of snapshot.teams)
			teams.push({ id, name, short, league });
	}
	return teams;
}

const withoutDate = (file: { provenance: RealLogos["provenance"] }) =>
	JSON.stringify({
		...file,
		provenance: { ...file.provenance, retrievedAt: "" },
	});

export interface LogosOptions extends ClientOptions {
	outputDir: string;
}

/** Writes `logos.json` next to the league snapshots; returns what was left out. */
export async function writeLogos(options: LogosOptions) {
	const teams = await readTeams(options.outputDir);
	const { logos, unmatched, retrievedAt } = await buildLogos(
		new Client(options),
		teams,
	);
	const file = realLogosSchema.parse({
		provenance: {
			source: "lolesports.com",
			endpoint: teamsUrl,
			retrievedAt,
			note: "Logo URLs from the public lolesports.com web API (getTeams), authorised by the project owner on 2026-11-22. The images belong to Riot Games and the teams and are downloaded by the app at runtime, never committed.",
		},
		logos,
	} satisfies RealLogos);
	await writeLogoMetadata(
		options.outputDir,
		logosFile,
		file,
		"logos",
		realLogosSchema,
	);
	return { logos: logos.length, unmatched, teams };
}

/** Write a stable snapshot while keeping a previous equivalent retrieval date. */
export async function writeLogoMetadata<
	K extends string,
	T extends { provenance: RealLogos["provenance"] } & Record<
		K,
		readonly unknown[]
	>,
>(
	outputDir: string,
	filename: string,
	file: T,
	key: K,
	schema: {
		safeParse(value: unknown): { success: true; data: T } | { success: false };
	},
) {
	const target = join(outputDir, filename);
	const existing = await readFile(target, "utf8").catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		},
	);
	try {
		const previous = schema.safeParse(JSON.parse(existing ?? "null"));
		if (previous.success && withoutDate(previous.data) === withoutDate(file))
			return;
	} catch {}
	const rows = file[key].map((logo) => `\t\t${JSON.stringify(logo)}`);
	const body = `{\n\t"provenance": ${JSON.stringify(file.provenance)},\n\t"${key}": [\n${rows.join(",\n")}\n\t]\n}\n`;
	await mkdir(outputDir, { recursive: true });
	const temp = `${target}.${randomUUID()}.tmp`;
	try {
		await writeFile(temp, body);
		await rename(temp, target);
	} finally {
		await rm(temp, { force: true });
	}
}
