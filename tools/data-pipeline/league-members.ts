import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { compare } from "./queries.ts";

/**
 * Teams of a league by id. `exclude` drops one the rule would keep; `include`
 * keeps one it would drop. Add a comment with the reason for each entry.
 */
export interface LeagueMemberExceptions {
	exclude: Readonly<Record<string, readonly string[]>>;
	include: Readonly<Record<string, readonly string[]>>;
}

/** Empty today: the latest-split rule gets every league right. */
export const leagueMemberExceptions: LeagueMemberExceptions = {
	exclude: {},
	include: {},
};

/** Playoffs, play-ins and qualifiers do not define who is in the league. */
const sideStage = /play-?offs?|play-?in|road to|grand finals?/i;

/**
 * Ids of the teams that belong to the league: those that played its latest
 * split (the tournament with the latest start that is not a side stage),
 * plus the exceptions. A renamed team keeps its id, so it stays. Players of
 * the other teams stay in the games and the history but form no roster.
 */
export function leagueTeamIds(
	snapshot: RealSnapshot,
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const dated = snapshot.tournaments.filter((t) => t.startsOn);
	const splits = dated.filter((t) => !sideStage.test(t.name));
	const latest = (splits.length ? splits : dated)
		.slice()
		.sort(
			(a, b) =>
				compare(a.startsOn ?? "", b.startsOn ?? "") || compare(a.id, b.id),
		)
		.at(-1);
	const ids = new Set(
		latest
			? snapshot.games
					.filter((game) => game.tournament === latest.id)
					.flatMap((game) => game.teams.map((team) => team.id))
			: snapshot.teams.map((team) => team.id),
	);
	const league = snapshot.league.id;
	for (const id of exceptions.include[league] ?? []) ids.add(id);
	for (const id of exceptions.exclude[league] ?? []) ids.delete(id);
	return ids;
}
