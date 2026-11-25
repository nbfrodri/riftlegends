import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import {
	type LeagueMemberExceptions,
	leagueTeamIds,
} from "./league-members.ts";
import { type ApiTeam, matchTeam, type SnapshotTeam } from "./logos.ts";
import { groupBy } from "./normalization.ts";
import { compare } from "./queries.ts";

type Role = NonNullable<RealSnapshot["seasonPlayers"][number]["role"]>;

/** Case, diacritics and edge or repeated spaces do not tell two handles apart. */
export const handleKey = (player: string | { handle: string }) =>
	(typeof player === "string" ? player : player.handle)
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();

const apiRoles: Readonly<Record<string, Role>> = {
	top: "top",
	jungle: "jungle",
	mid: "mid",
	bottom: "bot",
	support: "support",
};

/**
 * Who lolesports lists at a position of a team: handles as written, empty
 * when the team has no unambiguous match there. Only the position of the
 * player comes from here; attributes and stats stay with Leaguepedia.
 */
export type OfficialStarters = (team: SnapshotTeam, role: Role) => string[];

export const noOfficialStarters: OfficialStarters = () => [];

export function officialStarters(
	apiTeams: readonly ApiTeam[],
): OfficialStarters {
	return (team, role) => {
		const match = matchTeam(team, apiTeams);
		return typeof match === "string"
			? []
			: match.players
					.filter((player) => player.role && apiRoles[player.role] === role)
					.map(({ handle }) => handle);
	};
}

const snapshotTeam = (
	snapshot: RealSnapshot,
	team: RealSnapshot["teams"][number],
): SnapshotTeam => ({
	id: team.id,
	name: team.name,
	short: team.short,
	league: snapshot.league.id,
});

export function snapshotTeamById(snapshot: RealSnapshot, id: string) {
	const team = snapshot.teams.find((row) => row.id === id);
	if (!team) throw new Error(`Unknown team: ${id}`);
	return snapshotTeam(snapshot, team);
}

/**
 * Tiebreak: when a team has several players for a position, the core uses the
 * last of the (sub, games) order. If exactly one of them is on the lolesports
 * roster of that position (the others are no longer on the team page), that
 * one becomes the non-sub and the others subs. Ambiguous handles are never
 * guessed.
 */
export function preferOfficialStarters(
	snapshots: readonly RealSnapshot[],
	apiTeams: readonly ApiTeam[],
	exceptions?: LeagueMemberExceptions,
) {
	const official = officialStarters(apiTeams);
	return snapshots.map((snapshot) => {
		const inLeague = leagueTeamIds(snapshot, exceptions);
		const games = new Map<string, number>();
		const seen = groupBy(
			snapshot.games.flatMap((game) => game.lines),
			(row) => `${row.team}\u0000${row.player}`,
		);
		for (const [key, rows] of seen) games.set(key, rows.length);
		const flipped = new Map<string, boolean>();
		for (const team of snapshot.teams.filter(({ id }) => inLeague.has(id)))
			for (const role of ["top", "jungle", "mid", "bot", "support"] as const) {
				const candidates = snapshot.seasonPlayers.filter(
					(row) => row.team === team.id && row.role === role,
				);
				if (candidates.length < 2) continue;
				const played = (id: string) => games.get(`${team.id}\u0000${id}`) ?? 0;
				const current = [...candidates].sort(
					(a, b) =>
						Number(b.sub) - Number(a.sub) ||
						played(a.id) - played(b.id) ||
						compare(a.id, b.id),
				)[candidates.length - 1];
				// lolesports has no starter flag: its page lists the whole roster of a
				// position in no meaningful order. Only a lone listed candidate counts.
				const listed = new Set(
					official(snapshotTeam(snapshot, team), role).map(handleKey),
				);
				const named = candidates.filter((row) =>
					listed.has(handleKey(row.name)),
				);
				const wanted = named.length === 1 ? named[0] : undefined;
				if (!wanted || !current || wanted.id === current.id) continue;
				flipped.set(wanted.id, false);
				for (const row of candidates)
					if (row.id !== wanted.id && !row.sub) flipped.set(row.id, true);
			}
		return flipped.size
			? {
					...snapshot,
					seasonPlayers: snapshot.seasonPlayers.map((row) =>
						flipped.has(row.id)
							? { ...row, sub: flipped.get(row.id) ?? row.sub }
							: row,
					),
				}
			: snapshot;
	});
}
