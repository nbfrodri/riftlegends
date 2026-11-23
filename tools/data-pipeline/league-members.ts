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
 * Ids of the teams that belong to the league: those that played the latest
 * regular split, or more than half of the season's regular splits (a team
 * that left before the last split, like an LPL franchise, stays), plus the
 * exceptions. Regular splits are the tournaments that are not a side stage.
 * A renamed team keeps its id, so it stays. Players of the other teams stay
 * in the games and the history but form no roster.
 */
export function leagueTeamIds(
	snapshot: RealSnapshot,
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const dated = snapshot.tournaments.filter((t) => t.startsOn);
	const regular = dated.filter((t) => !sideStage.test(t.name));
	const splits = (regular.length ? regular : dated)
		.slice()
		.sort(
			(a, b) =>
				compare(a.startsOn ?? "", b.startsOn ?? "") || compare(a.id, b.id),
		);
	const played = new Map<string, Set<string>>();
	for (const game of snapshot.games)
		for (const { id } of game.teams) {
			const set = played.get(id) ?? new Set<string>();
			set.add(game.tournament);
			played.set(id, set);
		}
	const latest = splits.at(-1);
	const ids = new Set<string>(
		splits.length
			? snapshot.teams
					.map((team) => team.id)
					.filter((id) => {
						const mine = played.get(id);
						const count = splits.filter((t) => mine?.has(t.id)).length;
						return (
							count * 2 > splits.length || (latest && mine?.has(latest.id))
						);
					})
			: snapshot.teams.map((team) => team.id),
	);
	const league = snapshot.league.id;
	for (const id of exceptions.include[league] ?? []) ids.add(id);
	for (const id of exceptions.exclude[league] ?? []) ids.delete(id);
	return ids;
}
