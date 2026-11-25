import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { CargoRow, Client } from "./client.ts";
import {
	type LeagueMemberExceptions,
	leagueMemberExceptions,
	leagueTeamIds,
} from "./league-members.ts";
import { groupBy, person, roleOf } from "./normalization.ts";
import {
	handleKey,
	noOfficialStarters,
	type OfficialStarters,
	snapshotTeamById,
} from "./official-starters.ts";
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

const playerFields = "OverviewPage=Link,ID=Player,Team,Role,IsRetired=Retired";

/** The current roster of each team on its Leaguepedia player pages. */
function acquireCurrentRoster(client: Client, teamNames: readonly string[]) {
	return client.cargo(
		"Players",
		playerFields,
		inList("Team", teamNames),
		"OverviewPage",
		{ cacheRow },
	);
}

/** Leaguepedia player pages by handle: where lolesports' starters are found. */
function acquireByHandle(client: Client, handles: readonly string[]) {
	return client.cargo(
		"Players",
		playerFields,
		inList("ID", handles),
		"OverviewPage",
		{ cacheRow },
	);
}

/**
 * Fills every role gap with a real player, in this order: the team's current
 * Leaguepedia roster candidate that lolesports lists as starter; the player
 * lolesports lists as starter, matched by handle to a Leaguepedia page (the
 * one on the team's roster if several share the handle, none if still
 * ambiguous); the first (by id) of the team's current roster for the role.
 * Retired players and players of another team never qualify. Fails when
 * nobody does; an invented player is never published.
 */
export function fillRoleGaps(
	snapshots: readonly RealSnapshot[],
	current: readonly CargoRow[],
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
	official: OfficialStarters = noOfficialStarters,
) {
	const taken = new Set(
		snapshots.flatMap((snapshot) => snapshot.seasonPlayers.map(({ id }) => id)),
	);
	return snapshots.map((snapshot) => {
		const added: RealSnapshot["seasonPlayers"] = [];
		for (const gap of roleGaps(snapshot, exceptions)) {
			const starters = official(snapshotTeamById(snapshot, gap.team), gap.role);
			const free = current
				.filter((row) => row.Retired !== "1" && row.Link)
				.map((row) => ({
					id: person(row.Link ?? "").id,
					name: row.Player,
					team: row.Team,
					role: roleOf(row.Role ?? undefined),
				}))
				.filter(({ id }) => !taken.has(id));
			const roster = free
				.filter((row) => row.team === gap.name && row.role === gap.role)
				.sort((a, b) => compare(a.id, b.id));
			const named = (handle: string) =>
				free.filter(
					(row) => handleKey(row.name ?? row.id) === handleKey(handle),
				);
			const listed = starters.flatMap((handle) => {
				const same = named(handle);
				const mine = same.filter((row) => row.team === gap.name);
				return mine.length === 1 ? mine : same.length === 1 ? same : [];
			});
			const found =
				roster.find((row) => listed.some(({ id }) => id === row.id)) ??
				[...listed].sort((a, b) => compare(a.id, b.id))[0] ??
				roster[0];
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

/**
 * Looks the gaps up (the rosters of the teams with gaps and, for the
 * official starters, their handles; only when there are gaps) and fills them.
 */
export async function closeRoleGaps(
	client: Client,
	snapshots: readonly RealSnapshot[],
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
	official: OfficialStarters = noOfficialStarters,
) {
	const gaps = snapshots.flatMap((snapshot) =>
		roleGaps(snapshot, exceptions).map((gap) => ({
			...gap,
			starters: official(snapshotTeamById(snapshot, gap.team), gap.role),
		})),
	);
	const names = [...new Set(gaps.map(({ name }) => name))].sort(compare);
	if (!names.length) return [...snapshots];
	const handles = [...new Set(gaps.flatMap(({ starters }) => starters))].sort(
		compare,
	);
	return fillRoleGaps(
		snapshots,
		[
			...(await acquireCurrentRoster(client, names)),
			...(handles.length ? await acquireByHandle(client, handles) : []),
		],
		exceptions,
		official,
	);
}
