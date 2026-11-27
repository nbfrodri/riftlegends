import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	MIN_PAIR_GAMES,
	type RealSummoners,
	SUMMONER_SPELLS,
} from "@rift-legends/contracts/real-summoners";
import type { CatalogChampion } from "./champion-content.ts";
import { championResolver } from "./champion-history.ts";
import type { Client, ClientOptions } from "./client.ts";
import { roleOf } from "./normalization.ts";
import { compare, inList } from "./queries.ts";
import { leagues } from "./scope.ts";

/**
 * Summoner spells (#622). Cooldowns come from CommunityDragon (data only, the
 * icons are never stored). The usual pair per champion and role is counted
 * from the scoreboards of Leaguepedia: the query asks for champion, role and
 * spells only, so no game, team or player reaches the cache or the repo.
 */

type Spell = RealSummoners["spells"][number];
type Pair = RealSummoners["pairs"][number];
type Role = Pair["role"];
type SpellId = (typeof SUMMONER_SPELLS)[number];

const summonerSpellsUrl = (patch: string) =>
	`https://raw.communitydragon.org/${patch}/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json`;

const known = new Set<string>(SUMMONER_SPELLS);

/** The spells of Summoner's Rift; other modes reuse names with other numbers. */
export function readSpells(body: unknown): Spell[] {
	// The cache keeps `{ spells }` (id and cooldown); the source is the full list.
	const reduced = (body as { spells?: unknown } | null)?.spells;
	const entries = Array.isArray(reduced) ? reduced : body;
	if (!Array.isArray(entries)) throw new Error("Invalid summoner spells");
	const spells = new Map<string, Spell>();
	for (const entry of entries) {
		const { id, name, cooldown, gameModes } = (entry ?? {}) as Record<
			string,
			unknown
		>;
		const spell = Array.isArray(reduced) ? id : name;
		const onRift =
			Array.isArray(reduced) ||
			(typeof id === "number" &&
				id < 100 &&
				Array.isArray(gameModes) &&
				gameModes.includes("CLASSIC"));
		if (!onRift || typeof spell !== "string" || !known.has(spell)) continue;
		if (
			typeof cooldown !== "number" ||
			!Number.isInteger(cooldown) ||
			cooldown <= 0 ||
			spells.has(spell)
		)
			throw new Error(`Invalid summoner spell: ${spell}`);
		spells.set(spell, { id: spell as SpellId, cooldown });
	}
	const missing = SUMMONER_SPELLS.filter((spell) => !spells.has(spell));
	if (missing.length)
		throw new Error(`Summoner spells missing: ${missing.join(", ")}`);
	return SUMMONER_SPELLS.map((spell) => spells.get(spell) as Spell);
}

const spellsBody = (spells: readonly Spell[]) => ({ spells });

function pairOf(value: string | null | undefined) {
	const names = (value ?? "").split(",").map((name) => name.trim());
	const [a, b] = names;
	if (names.length !== 2 || !a || !b || a === b) return;
	if (!known.has(a) || !known.has(b)) return;
	return (a < b ? [a, b] : [b, a]) as [SpellId, SpellId];
}

type Counts = Map<string, number>;
const best = (counts: Counts) =>
	[...counts].sort(([a, x], [b, y]) => y - x || compare(a, b))[0] as [
		string,
		number,
	];
const roles: readonly Role[] = ["top", "jungle", "mid", "bot", "support"];

/** Rows with `Champion`, `Role`/`IngameRole` and `Spells`, as Cargo returns them. */
export function aggregatePairs(
	input: readonly Readonly<Record<string, string | null>>[],
	catalog: readonly CatalogChampion[],
) {
	const resolve = championResolver(catalog);
	const byChampion = new Map<string, Counts>();
	const byRole = new Map<Role, Counts>();
	let rows = 0;
	let skipped = 0;
	for (const row of input) {
		const role =
			roleOf(row.IngameRole ?? undefined) ?? roleOf(row.Role ?? undefined);
		const champion = resolve(row.Champion ?? "");
		const spells = pairOf(row.Spells);
		// Smite is the jungle's spell: elsewhere the row is a swapped role or a typo.
		if (
			!role ||
			!champion ||
			!spells ||
			spells.includes("Smite") !== (role === "jungle")
		) {
			skipped++;
			continue;
		}
		rows++;
		const pair = spells.join(",");
		for (const [map, key] of [
			[byChampion, `${champion}/${role}`],
			[byRole, role],
		] as const) {
			const counts = map.get(key as never) ?? new Map();
			counts.set(pair, (counts.get(pair) ?? 0) + 1);
			map.set(key as never, counts);
		}
	}
	const pairs: Pair[] = [];
	for (const [key, counts] of byChampion) {
		const games = [...counts.values()].reduce((sum, n) => sum + n, 0);
		if (games < MIN_PAIR_GAMES) continue;
		const [champion, role] = key.split("/") as [string, Role];
		const [pair, pairGames] = best(counts);
		pairs.push({
			champion,
			role,
			spells: pair.split(",") as Pair["spells"],
			games,
			pairGames,
		});
	}
	pairs.sort(
		(a, b) => compare(a.champion, b.champion) || compare(a.role, b.role),
	);
	const roleDefaults: Partial<RealSummoners["roleDefaults"]> = {};
	for (const [role, counts] of byRole) {
		const [pair, games] = best(counts);
		roleDefaults[role] = { spells: pair.split(",") as Pair["spells"], games };
	}
	return { pairs, roleDefaults, rows, skipped };
}

/** A role without any pair is a broken source, not a gap to fill silently. */
export function requireRoleDefaults(
	defaults: Partial<RealSummoners["roleDefaults"]>,
): RealSummoners["roleDefaults"] {
	for (const role of roles)
		if (!defaults[role]) throw new Error(`No spell pairs for the ${role} role`);
	return defaults as RealSummoners["roleDefaults"];
}

/**
 * The spell cooldowns and the usual pairs of the games of `season` before
 * `through` (a UTC day, so the query changes daily).
 */
export async function acquireSummoners(
	client: Client,
	catalog: readonly CatalogChampion[],
	season: number,
	through: string,
	patch: string,
) {
	const url = summonerSpellsUrl(patch);
	const spells = await client.get(url, readSpells, spellsBody);
	const retrievedAt = client.queries.get(url);
	const rows = await client.cargo(
		"ScoreboardPlayers=SP,Tournaments=T",
		"SP.Champion=Champion,SP.Role=Role,SP.IngameRole=IngameRole,SP.SummonerSpells=Spells",
		`T.Year='${season}' AND T.IsOfficial='1' AND T.TournamentLevel='Primary' AND ${inList(
			"T.League",
			leagues.map(({ name }) => name),
		)} AND SP.DateTime_UTC < '${through}'`,
		"SP.GameId,SP.GameRoleId",
		{ join_on: "SP.OverviewPage=T.OverviewPage" },
	);
	const { roleDefaults, ...counted } = aggregatePairs(rows, catalog);
	return {
		spells,
		retrievedAt,
		url,
		...counted,
		roleDefaults: requireRoleDefaults(roleDefaults),
	};
}

export const serializeSummoners = (file: RealSummoners) =>
	`${JSON.stringify(file, null, "\t").replace(
		/\[\s+("[^"\]]*"(?:,\s+"[^"\]]*")*)\s+\]/g,
		(_, list: string) => `[${list.replace(/\s+/g, " ")}]`,
	)}\n`;

interface SummonerOptions extends ClientOptions {
	outputDir: string;
}

export async function writeSummoners(
	options: SummonerOptions,
	catalog: readonly CatalogChampion[],
	season: number,
	through: string,
	patch: string,
	client: Client,
) {
	const result = await acquireSummoners(
		client,
		catalog,
		season,
		through,
		patch,
	);
	const file: RealSummoners = {
		provenance: {
			cooldowns: {
				source: "CommunityDragon",
				patch,
				url: result.url,
				retrievedAt: result.retrievedAt ?? "unknown",
			},
			pairs: {
				source: "Leaguepedia",
				domain: "lol.fandom.com",
				licence: "CC BY-SA 3.0",
				attribution:
					"Pares de hechizos agregados por campeón y rol desde los marcadores de Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported. No se guardan datos por partida ni por jugador.",
				season,
				minGames: MIN_PAIR_GAMES,
				rows: result.rows,
			},
		},
		spells: result.spells,
		roleDefaults: result.roleDefaults,
		pairs: result.pairs,
	};
	const path = join(options.outputDir, "summoners.json");
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, serializeSummoners(file));
	return {
		pairs: result.pairs.length,
		rows: result.rows,
		skipped: result.skipped,
	};
}
