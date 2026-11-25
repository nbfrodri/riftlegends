import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { attributeProfiles, playerLevel, type Role } from "./attributes.ts";
import { careerStrength, type Season } from "./career.ts";
import { byGames, pool, rolePools } from "./champion-pool.ts";
import { coachStyles } from "./coach-style.ts";
import {
	type LeagueMemberExceptions,
	leagueMemberExceptions,
	leagueTeamIds,
} from "./league-members.ts";
import { eloOf, leagueRating } from "./league-strength.ts";
import { groupBy } from "./normalization.ts";
import { nick, uniqueHandles } from "./player-handles.ts";
import { compare } from "./queries.ts";
import { seasonOf } from "./season.ts";

type Game = RealSnapshot["games"][number];
type Team = RealSnapshot["teams"][number];

const roles: readonly Role[] = ["top", "jungle", "mid", "bot", "support"];
// On a tie the shotcaller is the player who usually calls the plays.
const leaderOrder: readonly Role[] = ["mid", "jungle", "support", "top", "bot"];

function coachOf(snapshot: RealSnapshot, team: string) {
	const starts = new Map(
		snapshot.tournaments.map((row) => [row.id, row.startsOn ?? ""]),
	);
	const rosters = snapshot.rosters
		.filter((roster) => roster.team === team && roster.coaches.length)
		.sort(
			(a, b) =>
				compare(
					starts.get(b.tournament) ?? "",
					starts.get(a.tournament) ?? "",
				) || compare(a.tournament, b.tournament),
		);
	const coaches = [...(rosters[0]?.coaches ?? [])].sort((a, b) =>
		compare(a.id, b.id),
	);
	return coaches.find((row) => /head/i.test(row.role)) ?? coaches[0];
}

function together(games: readonly Game[]) {
	const counts = new Map<string, number>();
	for (const game of games) {
		for (const lines of groupBy(game.lines, (line) => line.team).values()) {
			const ids = lines.map((line) => line.player).sort(compare);
			for (const [i, a] of ids.entries()) {
				for (const b of ids.slice(i + 1)) {
					const pair = JSON.stringify([a, b]);
					counts.set(pair, (counts.get(pair) ?? 0) + 1);
				}
			}
		}
	}
	return (a: string, b: string) =>
		counts.get(JSON.stringify([a, b].sort(compare))) ?? 0;
}

export type CareerHistory = ReadonlyMap<string, readonly Season[]>;

function build(
	snapshot: RealSnapshot,
	careers: CareerHistory,
	season: number,
	exceptions: LeagueMemberExceptions,
) {
	const inLeague = leagueTeamIds(snapshot, exceptions);
	const profileOf = attributeProfiles(snapshot);
	const styleOf = coachStyles(snapshot.games);
	const pools = rolePools(snapshot.games);
	const gamesTogether = together(snapshot.games);
	const rolesByPlayer = groupBy(
		snapshot.games.flatMap((game) => game.lines.filter((line) => line.role)),
		(line) => line.player,
	);
	const gamesBy = groupBy(
		snapshot.games.flatMap((game) => game.lines),
		(line) => line.player,
	);

	const make = (
		id: string,
		team: string,
		role: Role,
		extra: { handle: string; sub?: boolean },
	) => {
		const lines = (gamesBy.get(id) ?? []).filter((line) => line.role === role);
		const champions = [
			...groupBy(
				lines.flatMap((line) => line.champion ?? []),
				(c) => c,
			),
		]
			.map(([champion, rows]): [string, number] => [champion, rows.length])
			.sort(byGames);
		const career = careerStrength(careers.get(id) ?? [], season);
		const { attributes, estimated } = profileOf(id, role, career);
		const level = playerLevel(attributes, role, career);
		return {
			games: lines.length,
			row: {
				id,
				team,
				role,
				handle: nick(extra.handle),
				...(extra.sub !== undefined ? { sub: extra.sub } : {}),
				...(estimated.length ? { estimated } : {}),
				level,
				...pool(champions, pools(role)),
				attributes,
				leader: false,
			},
		};
	};

	const members = snapshot.seasonPlayers.flatMap((player) => {
		if (!inLeague.has(player.team)) return [];
		const seen = [
			...groupBy(rolesByPlayer.get(player.id) ?? [], (line) => line.role ?? ""),
		].sort((a, b) => b[1].length - a[1].length || compare(a[0], b[0]))[0]?.[0];
		const role = player.role ?? roles.find((r) => r === seen);
		return role
			? [
					{
						team: player.team,
						...make(player.id, player.team, role, {
							handle: player.name,
							sub: player.sub,
						}),
					},
				]
			: [];
	});

	const playoffs = new Set(
		snapshot.tournaments
			.filter((tournament) => /playoff/i.test(tournament.name))
			.map((tournament) => tournament.id),
	);
	const games = (id: string) =>
		snapshot.games.filter((game) => game.teams.some((t) => t.id === id));
	const teams = snapshot.teams
		.filter((team) => inLeague.has(team.id))
		.map((team: Team) => {
			const played = games(team.id);
			const roster = members.filter((member) => member.team === team.id);
			for (const role of roles)
				if (!roster.some((member) => member.row.role === role))
					throw new Error(
						`${team.name} (${team.id}) has no ${role}: the snapshot must name a real one, never an invented player`,
					);
			roster.sort(
				(a, b) =>
					roles.indexOf(a.row.role) - roles.indexOf(b.row.role) ||
					Number(b.row.sub ?? false) - Number(a.row.sub ?? false) ||
					a.games - b.games ||
					compare(a.row.id, b.row.id),
			);
			// The last player of a role is the one the core uses (see content-index).
			const starters = roles.flatMap(
				(role) => roster.filter((m) => m.row.role === role).at(-1) ?? [],
			);
			const leader = starters.reduce((best, member) =>
				member.row.attributes.shotcalling > best.row.attributes.shotcalling ||
				(member.row.attributes.shotcalling ===
					best.row.attributes.shotcalling &&
					leaderOrder.indexOf(member.row.role) <
						leaderOrder.indexOf(best.row.role))
					? member
					: best,
			);
			leader.row.leader = true;
			const starter = (role: Role) =>
				starters.find((member) => member.row.role === role)?.row.id ?? "";
			const link = (a: Role, b: Role) => ({
				a: starter(a),
				b: starter(b),
				value: Math.round(
					40 +
						(40 * gamesTogether(starter(a), starter(b))) /
							(gamesTogether(starter(a), starter(b)) + 20),
				),
			});
			const coach = coachOf(snapshot, team.id);
			// Elo-like rating: league prior plus the smoothed win rate (12 prior
			// games at 50 %, playoff games count double), rounded to whole points.
			const weight = (game: Game) => (playoffs.has(game.tournament) ? 2 : 1);
			const total = played.reduce((sum, game) => sum + weight(game), 0);
			const won = played
				.filter((game) => game.winner === team.id)
				.reduce((sum, game) => sum + weight(game), 0);
			const rating = Math.round(
				(leagueRating[snapshot.league.id] ?? 0) +
					eloOf((won + 6) / (total + 12)),
			);
			return {
				score: rating,
				players: roster.map((member) => member.row),
				team: {
					id: team.id,
					name: team.name,
					...(team.short ? { short: team.short } : {}),
					league: team.league,
					...(team.logo ? { logo: team.logo } : {}),
					seed: 0,
					coach: {
						name: coach?.name ?? "—",
						personality: coach
							? styleOf(team.id)
							: ("balanced" as ReturnType<typeof styleOf>),
						rating: 25,
					},
					chemistry: [
						link("top", "jungle"),
						link("mid", "jungle"),
						link("bot", "support"),
					],
					strategy: {
						tempo: "balanced",
						objectives: "balanced",
						risk: "balanced",
					} as const,
					adaptation: 50,
				},
			};
		});
	return teams;
}

export function buildPlayerTeamContent(
	snapshots: readonly RealSnapshot[],
	careers: CareerHistory = new Map(),
	nationalities: ReadonlyMap<string, string> = new Map(),
	exceptions: LeagueMemberExceptions = leagueMemberExceptions,
) {
	const season = seasonOf(snapshots);
	const built =
		season === undefined
			? []
			: snapshots.flatMap((snapshot) =>
					build(snapshot, careers, season, exceptions),
				);
	const ids = new Set<string>();
	for (const { team, players } of built) {
		for (const id of [team.id, ...players.map((p) => p.id)]) {
			if (ids.has(id)) throw new Error(`Duplicate id across leagues: ${id}`);
			ids.add(id);
		}
	}
	// One global order: league prior + smoothed win rate as an Elo-like rating.
	built.sort((a, b) => b.score - a.score || compare(a.team.id, b.team.id));
	const teams = built.map(({ team }, index) => ({ ...team, seed: index + 1 }));
	const players = uniqueHandles(
		built.flatMap(({ players: rows }) =>
			rows.map((row) => {
				const nationality = nationalities.get(row.id);
				return { ...row, ...(nationality && { nationality }) };
			}),
		),
		new Map(teams.map((team) => [team.id, team.short ?? team.id])),
	);
	const firstSnapshot = snapshots[0];
	return {
		players,
		teams,
		provenance: {
			source: firstSnapshot?.provenance.source ?? "Leaguepedia",
			licence: firstSnapshot?.provenance.licence ?? "",
			attribution: firstSnapshot?.provenance.attribution ?? "",
			leagues: snapshots
				.map((s) => ({
					id: s.league.id,
					retrievedAt:
						s.provenance.queries
							.map((q) => q.retrievedAt)
							.sort(compare)
							.at(-1) ?? "",
				}))
				.sort((a, b) => compare(a.id, b.id)),
		},
	};
}
