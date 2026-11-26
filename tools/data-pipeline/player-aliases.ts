import type { CargoRow, Client } from "./client.ts";
import { person } from "./normalization.ts";

const quote = (values: readonly string[]) =>
	values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",");

/**
 * Player ids that Leaguepedia redirects to another page, as `alias id ->
 * canonical id`. A person can be filed under two links (`Van (Kim Seung-hoo)`
 * in one roster and `Van1` everywhere else); the wiki redirect is the proof
 * that both are the same person. Disambiguators can hold real names, so only
 * ids (with their fingerprint) are kept, in memory and in the cache.
 */
export async function acquirePlayerAliases(
	client: Client,
	pages: readonly string[],
) {
	const aliases = new Map<string, string>();
	const cacheRow = (row: CargoRow) => ({
		Link: row.Link ? person(row.Link).id : null,
		Page: row.Page ? person(row.Page).id : null,
	});
	for (const [table, alias] of [
		["ScoreboardPlayers=SP", "SP"],
		["TournamentPlayers=TP", "TP"],
	] as const) {
		const rows = await client.cargo(
			`${table},PlayerRedirects=PR`,
			`${alias}.Link=Link,PR.OverviewPage=Page`,
			`${alias}.OverviewPage IN (${quote(pages)})`,
			`${alias}.Link`,
			{
				join_on: `${alias}.Link=PR.AllName`,
				group_by: `${alias}.Link,PR.OverviewPage`,
				cacheRow,
			},
		);
		for (const { Link, Page } of rows)
			if (Link && Page && Link !== Page) aliases.set(Link, Page);
	}
	return aliases;
}
