import type { CatalogChampion } from "./champion-content.ts";
import { recordPick, type SeasonPresence } from "./champion-presence.ts";
import { type Client, OfflineCacheMiss } from "./client.ts";
import { historicalLeagueFilter } from "./history.ts";
import { roleOf } from "./normalization.ts";

const normalize = (name: string) =>
	name.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = new Map([
	["wukong", "monkeyking"],
	["nunuandwillump", "nunu"],
	["nunuwillump", "nunu"],
	["renataglasc", "renata"],
]);

function count(value: string | null | undefined) {
	const n = Number(value);
	if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(n))
		throw new Error(`Invalid historical game count: ${value}`);
	return n;
}

export async function championHistory(
	client: Client,
	catalog: readonly CatalogChampion[],
	current: number,
	currentBanRatio: number,
) {
	const ids = new Map(catalog.map(({ id }) => [normalize(id), id]));
	const seasons: SeasonPresence[] = [];
	const missing: number[] = [];
	for (const year of [current - 1, current - 2]) {
		try {
			const where = historicalLeagueFilter(year);
			const games = await client.cargo(
				"ScoreboardGames=SG,Tournaments=T",
				"COUNT(*)=Games",
				where,
				"Games",
				{ join_on: "SG.OverviewPage=T.OverviewPage" },
			);
			const season: SeasonPresence = {
				year,
				games: count(games[0]?.Games),
				champions: new Map(),
			};
			if (!season.games) {
				missing.push(year);
				continue;
			}
			const picks = await client.cargo(
				"ScoreboardPlayers=SP,Tournaments=T",
				"SP.Champion=Champion,SP.IngameRole=IngameRole,SP.Role=Role,COUNT(*)=Games",
				where,
				"SP.Champion,SP.IngameRole,SP.Role",
				{
					join_on: "SP.OverviewPage=T.OverviewPage",
					group_by: "SP.Champion,SP.IngameRole,SP.Role",
				},
			);
			for (const row of picks) {
				const name = normalize(row.Champion ?? "");
				if (!name || name === "none") continue;
				const id = ids.get(aliases.get(name) ?? name);
				if (!id)
					throw new Error(`Unmapped historical champion: ${row.Champion}`);
				const role =
					roleOf(row.IngameRole ?? undefined) ?? roleOf(row.Role ?? undefined);
				recordPick(season, id, role, count(row.Games));
			}
			for (const entry of season.champions.values())
				entry.bans = entry.picks * currentBanRatio;
			seasons.push(season);
		} catch (error) {
			if (!(error instanceof OfflineCacheMiss)) throw error;
			missing.push(year);
		}
	}
	return { seasons, missing };
}
