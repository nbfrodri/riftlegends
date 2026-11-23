import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { maxPlayerPhotoBytes } from "@rift-legends/contracts/real-logos";
import {
	parseRiotPhotoUrl,
	type RealPhotos,
	realPhotoSchema,
	realPhotosSchema,
} from "@rift-legends/contracts/real-photos";
import { Client, type ClientOptions, OfflineCacheMiss } from "./client.ts";
import {
	type ApiTeam,
	httpsOf,
	matchTeam,
	parseApiTeams,
	type SnapshotTeam,
	teamsUrl,
} from "./logos.ts";
import { groupBy } from "./normalization.ts";
import { compare } from "./queries.ts";

interface SnapshotPlayer {
	id: string;
	team: string;
	handle: string;
	placeholder?: boolean;
}

/** Case, diacritics and edge or repeated spaces do not tell two handles apart. */
const handleKey = (player: { handle: string }) =>
	player.handle
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
const placeholder =
	/^(?:\d+_)?(?:default-headshot|download|silhouette(?:_transparent)?|placeholder_?|eSports_male_NoPlayer)\./i;

function photoUrl(image: string | null) {
	const url = image && parseRiotPhotoUrl(httpsOf(image));
	if (url && !placeholder.test(url.pathname.split("/").at(-1) ?? ""))
		return url;
}

/** Metadata from the same getTeams cache as logos, with no stored image bytes. */
export async function writePhotos(
	options: ClientOptions & { outputDir: string },
) {
	const { outputDir } = options;
	const read = async (file: string) =>
		JSON.parse(await readFile(join(outputDir, file), "utf8"));
	const teams: SnapshotTeam[] = await read("teams.json");
	const players: SnapshotPlayer[] = await read("players.json");
	const client = new Client(options);
	const apiTeams = await client.get(teamsUrl, parseApiTeams);
	const retrievedAt = client.queries.get(teamsUrl);
	const eligible = players.filter((p) => !p.placeholder);
	const playersByTeam = groupBy(eligible, (p) => p.team);
	const photos: RealPhotos["photos"] = [];
	const unmatched: { player: string; reason: string }[] = [];
	const matches = new Map(
		teams.map((team) => [team.id, matchTeam(team, apiTeams)]),
	);
	const leagueName = (team: ApiTeam) => team.homeLeague?.name.toLowerCase();
	const leagueCandidate = (match: ApiTeam, handle: string) => {
		const league = leagueName(match);
		if (!league) return undefined;
		const found = apiTeams
			.filter((team) => leagueName(team) === league)
			.flatMap((team) => team.players)
			.filter((candidate) => handleKey(candidate) === handle);
		const mine = eligible.filter((p) => {
			const other = matches.get(p.team);
			return (
				other &&
				typeof other !== "string" &&
				leagueName(other) === league &&
				handleKey(p) === handle
			);
		});
		return found.length === 1 && mine.length === 1 ? found[0] : undefined;
	};
	for (const player of eligible.sort((a, b) => compare(a.id, b.id))) {
		const { id, team } = player;
		const match = matches.get(team);
		if (!match || typeof match === "string") {
			unmatched.push({ player: id, reason: match ?? "no snapshot team" });
			continue;
		}
		const handle = handleKey(player);
		const candidates = match.players.filter(
			(candidate) => handleKey(candidate) === handle,
		);
		const snapshotMatches = playersByTeam
			.get(team)
			?.filter((p) => handleKey(p) === handle);
		if (candidates.length > 1 || (snapshotMatches?.length ?? 0) > 1) {
			unmatched.push({ player: id, reason: "ambiguous handle" });
			continue;
		}
		// A moved player: only when the handle is unique in the whole league, both
		// in the API and in the snapshot. Never a guess between several.
		const candidate = candidates[0] ?? leagueCandidate(match, handle);
		const url = candidate && photoUrl(candidate.image);
		if (!url) {
			unmatched.push({
				player: id,
				reason: candidate ? "no usable photo URL" : "no handle in the team",
			});
			continue;
		}
		try {
			const digest = await client.imageDigest(url.href, maxPlayerPhotoBytes);
			photos.push(
				realPhotoSchema.parse({ player: id, url: url.href, ...digest }),
			);
		} catch (error) {
			if (error instanceof OfflineCacheMiss) throw error;
			unmatched.push({
				player: id,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}
	const file = realPhotosSchema.parse({
		provenance: {
			source: "lolesports.com",
			endpoint: teamsUrl,
			retrievedAt,
			note: "Player photo URLs from the public lolesports.com web API (getTeams). The app downloads official images at runtime. Image bytes are never committed.",
		},
		photos,
	});
	const target = join(outputDir, "photos.json");
	const rows = file.photos.map((photo) => `\t\t${JSON.stringify(photo)}`);
	const list = rows.length ? `[\n${rows.join(",\n")}\n\t]` : "[]";
	const body = `{\n\t"provenance": ${JSON.stringify(file.provenance)},\n\t"photos": ${list}\n}\n`;
	const temp = `${target}.${randomUUID()}.tmp`;
	try {
		await writeFile(temp, body);
		await rename(temp, target);
	} finally {
		await rm(temp, { force: true });
	}
	return {
		photos: photos.length,
		unmatched,
		players: players.length,
	};
}
