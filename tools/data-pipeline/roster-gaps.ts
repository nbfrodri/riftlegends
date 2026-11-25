import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { CargoRow, Client } from "./client.ts";
import {
	type LeagueMemberExceptions,
	leagueMemberExceptions,
	leagueTeamIds,
} from "./league-members.ts";
import { groupBy, person, roleOf } from "./normalization.ts";
import { compare, inList } from "./queries.ts";

type Role = NonNullable<RealSnapshot["seasonPlayers"][number]["role"]>;
const roles: readonly Role[] = ["top", "jungle", "mid", "bot", "support"];

/**
 * Teams of the league that have nobody in a role. The season keeps each
 * player on the last team they played for, so a team whose starter moved
 * (to another league, say) after its last split is left with a gap.
 */
export function roleGaps(
	snapshot: RealSnapshot,
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const seen = groupBy(
		snapshot.games.flatMap((game) => game.lines.filter((line) => line.role)),
		(line) => line.player,
	);
	const roleOfPlayer = (player: RealSnapshot["seasonPlayers"][number]) =>
		player.role ??
		[...groupBy(seen.get(player.id) ?? [], (line) => line.role ?? "")].sort(
			(a, b) => b[1].length - a[1].length || compare(a[0], b[0]),
		)[0]?.[0];
	const inLeague = leagueTeamIds(snapshot, exceptions);
	return snapshot.teams
		.filter((team) => inLeague.has(team.id))
		.flatMap((team) =>
			roles
				.filter(
					(role) =>
						!snapshot.seasonPlayers.some(
							(player) =>
								player.team === team.id && roleOfPlayer(player) === role,
						),
				)
				.map((role) => ({ team: team.id, name: team.name, role })),
		);
}

const cacheRow = (row: CargoRow) => ({
	Link: row.Link ? person(row.Link).id : null,
	Player: row.Player ?? null,
	Team: row.Team ?? null,
	Role: row.Role ?? null,
	Retired: row.Retired ?? null,
});

/** The current roster of each team on its Leaguepedia player pages. */
export function acquireCurrentRoster(
	client: Client,
	teamNames: readonly string[],
) {
	return client.cargo(
		"Players",
		"OverviewPage=Link,ID=Player,Team,Role,IsRetired=Retired",
		inList("Team", teamNames),
		"OverviewPage",
		{ cacheRow },
	);
}

/**
 * Fills every role gap with a real player: the first (by id) of the team's
 * current Leaguepedia roster for that role who is not retired and does not
 * already play for another team. Fails when nobody qualifies; an invented
 * player is never published.
 */
export function fillRoleGaps(
	snapshots: readonly RealSnapshot[],
	current: readonly CargoRow[],
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const taken = new Set(
		snapshots.flatMap((snapshot) => snapshot.seasonPlayers.map(({ id }) => id)),
	);
	return snapshots.map((snapshot) => {
		const added: RealSnapshot["seasonPlayers"] = [];
		for (const gap of roleGaps(snapshot, exceptions)) {
			const found = current
				.filter(
					(row) =>
						row.Team === gap.name &&
						row.Retired !== "1" &&
						roleOf(row.Role ?? undefined) === gap.role &&
						row.Link,
				)
				.map((row) => ({ id: person(row.Link ?? "").id, name: row.Player }))
				.filter(({ id }) => !taken.has(id))
				.sort((a, b) => compare(a.id, b.id))[0];
			if (!found)
				throw new Error(
					`No real ${gap.role} found for ${gap.name} (${snapshot.league.id}): neither its games nor its current Leaguepedia roster has one`,
				);
			taken.add(found.id);
			added.push({
				id: found.id,
				name: found.name ?? found.id,
				role: gap.role,
				sub: false,
				noGames: true,
				team: gap.team,
			});
		}
		return added.length
			? {
					...snapshot,
					seasonPlayers: [...snapshot.seasonPlayers, ...added].sort((a, b) =>
						compare(a.id, b.id),
					),
				}
			: snapshot;
	});
}

/** Looks the gaps up (one query, only when there are any) and fills them. */
export async function closeRoleGaps(
	client: Client,
	snapshots: readonly RealSnapshot[],
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const names = [
		...new Set(
			snapshots.flatMap((snapshot) =>
				roleGaps(snapshot, exceptions).map(({ name }) => name),
			),
		),
	].sort(compare);
	if (!names.length) return [...snapshots];
	return fillRoleGaps(
		snapshots,
		await acquireCurrentRoster(client, names),
		exceptions,
	);
}
