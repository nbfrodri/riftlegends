import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { CargoRow, Client } from "./client.ts";
import { compare, inList } from "./queries.ts";
import { type LeagueScope, leagues } from "./scope.ts";
import {
	type SeasonExceptions,
	seasonExceptions,
} from "./season-exceptions.ts";

/**
 * Below this many games in a league this season, the previous season's
 * tournaments are mixed into its attributes. About 30 games per player
 * (`minPlayerGames`) in a ten-team league: 30 × 10 / 2 = 150.
 */
export const mixLeagueGames = 150;
/** A player with fewer games than this borrows the rest from last season. */
export const minPlayerGames = 30;

const text = (row: CargoRow, name: string) => row[name]?.trim() ?? "";
const sideEvent =
	/\b(?:show[ -]?match|exhibition|promotions?|relegations?|qualifiers?|regional finals)\b/i;

export function seasonOf(
	snapshots: readonly Pick<RealSnapshot, "season" | "games">[],
) {
	let latest = 0;
	for (const { season, games } of snapshots) {
		if (season !== undefined) latest = Math.max(latest, season);
		else
			for (const { date } of games)
				latest = Math.max(latest, Number(date.slice(0, 4)));
	}
	return latest || undefined;
}

/**
 * Main competition of one league and year: official, primary level, not a
 * qualifier, and started in that year (so the previous season's promotion,
 * filed under the new year, stays out). Showmatches are not `Primary`.
 */
export function selectPages(
	rows: readonly CargoRow[],
	league: string,
	year: number,
	exceptions: readonly string[] = [],
) {
	return rows
		.filter(
			(row) =>
				text(row, "League") === league &&
				text(row, "Year") === String(year) &&
				text(row, "TournamentLevel") === "Primary" &&
				text(row, "IsOfficial") === "1" &&
				text(row, "IsQualifier") !== "1" &&
				text(row, "DateStart").startsWith(`${year}-`) &&
				text(row, "OverviewPage") !== "" &&
				!sideEvent.test(text(row, "OverviewPage")) &&
				!exceptions.includes(text(row, "OverviewPage")),
		)
		.map((row) => text(row, "OverviewPage"))
		.sort(compare);
}

async function listSeason(
	client: Pick<Client, "cargo">,
	year: number,
	exceptions: SeasonExceptions,
	withGames: boolean,
) {
	const rows = await client.cargo(
		"Tournaments",
		"OverviewPage,League,Year,DateStart,TournamentLevel,IsQualifier,IsOfficial",
		`Year='${year}' AND ${inList(
			"League",
			leagues.map(({ name }) => name),
		)}`,
		"OverviewPage",
	);
	const pages = new Map<string, string[]>(
		leagues.map(({ id, name }) => [
			id,
			[
				...new Set([
					...selectPages(rows, name, year, exceptions.exclude[id]),
					...(exceptions.include[id] ?? []),
				]),
			].sort(compare),
		]),
	);
	const counts = new Map<string, number>();
	if (withGames) {
		const all = [...pages.values()].flat();
		const found = all.length
			? await client.cargo(
					"ScoreboardGames",
					"OverviewPage,COUNT(*)=Games",
					inList("OverviewPage", all),
					"OverviewPage",
					{ group_by: "OverviewPage" },
				)
			: [];
		for (const row of found)
			counts.set(text(row, "OverviewPage"), Number(text(row, "Games")) || 0);
		// A tournament with no game yet is not part of the season.
		for (const [id, list] of pages)
			pages.set(
				id,
				list.filter((page) => (counts.get(page) ?? 0) > 0),
			);
	}
	return { pages, counts };
}

/**
 * The current season and its tournaments, found in Cargo (two aggregate
 * queries per year, none per game). The season is the year of `now` once all
 * six leagues have played a game in it; until then it is still the year
 * before. A league with few games this season also lists the previous
 * season's tournaments (`previousPages`).
 */
export async function discoverSeason(
	client: Pick<Client, "cargo">,
	now: Date,
	exceptions: SeasonExceptions = seasonExceptions,
	closedSeasons = client,
) {
	const calendar = now.getUTCFullYear();
	let season = calendar;
	let current = await listSeason(client, season, exceptions, true);
	if ([...current.pages.values()].some((pages) => !pages.length)) {
		season = calendar - 1;
		current = await listSeason(client, season, exceptions, true);
	}
	const missing = leagues.filter(({ id }) => !current.pages.get(id)?.length);
	if (missing.length)
		throw new Error(
			`No played tournaments for ${season}: ${missing.map(({ id }) => id).join(", ")}`,
		);
	const scope: LeagueScope[] = [];
	let previous: Awaited<ReturnType<typeof listSeason>> | undefined;
	for (const { id, name } of leagues) {
		const pages = current.pages.get(id) ?? [];
		const games = pages.reduce(
			(total, page) => total + (current.counts.get(page) ?? 0),
			0,
		);
		let previousPages: string[] = [];
		if (games < mixLeagueGames) {
			previous ??= await listSeason(
				closedSeasons,
				season - 1,
				exceptions,
				false,
			);
			previousPages = previous.pages.get(id) ?? [];
		}
		scope.push({
			id,
			name,
			pages,
			...(previousPages.length ? { previousPages } : {}),
		});
	}
	return { season, scope };
}
