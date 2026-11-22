import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { PLAYER_ATTRIBUTES } from "../../packages/contracts/draft/player-attributes.ts";
import { attributeProfiles, type Role } from "./attributes.ts";
import { coachStyles } from "./coach-style.ts";
import { leagueStrength } from "./league-strength.ts";
import { groupBy } from "./normalization.ts";
import { compare } from "./queries.ts";

type Game = RealSnapshot["games"][number];
type Team = RealSnapshot["teams"][number];

const roles: readonly Role[] = ["top", "jungle", "mid", "bot", "support"];
// On a tie the shotcaller is the player who usually calls the plays.
const leaderOrder: readonly Role[] = ["mid", "jungle", "support", "top", "bot"];
const poolSize = 3;
const maxMains = 3;
const maxSecondary = 5;

/** Mastery from games played: 40 with none, rising towards 90. Fillers get 30. */
const masteryFrom = (games: number) =>
	Math.round(40 + (50 * games) / (games + 6));
const fillerMastery = 30;

const byGames = (a: [string, number], b: [string, number]) =>
	b[1] - a[1] || compare(a[0], b[0]);

function rolePools(games: readonly Game[]) {
	const counts = new Map<Role, Map<string, number>>();
	for (const line of games.flatMap((game) => game.lines)) {
		if (!line.role || !line.champion) continue;
		const roleCounts = counts.get(line.role) ?? new Map<string, number>();
		roleCounts.set(line.champion, (roleCounts.get(line.champion) ?? 0) + 1);
		counts.set(line.role, roleCounts);
	}
	return (role: Role) =>
		[...(counts.get(role) ?? [])].sort(byGames).map(([id]) => id);
}

function pool(played: [string, number][], fillers: readonly string[]) {
	const known = new Set(played.map(([id]) => id));
	const extra = fillers.filter((id) => !known.has(id));
	const total = played.reduce((sum, [, games]) => sum + games, 0);
	const value = new Map(
		played.map(([champion, games]) => [champion, masteryFrom(games)]),
	);
	if (played.length === 0) {
		const [a, b, c, d, e] = extra;
		return {
			mains: [a, b].flatMap((id) => id ?? []),
			secondary: [c, d].flatMap((id) => id ?? []),
			weak: e ? [e] : [],
			mastery: extra
				.slice(0, 5)
				.map((champion) => ({ champion, value: fillerMastery })),
		};
	}
	const mains = played
		.filter(
			([, games], index) => index === 0 || (games >= 3 && games / total >= 0.2),
		)
		.slice(0, maxMains);
	const weak = extra.slice(0, Math.max(1, poolSize - played.length));
	const secondary = played
		.slice(mains.length, mains.length + maxSecondary)
		.map(([id]) => id);
	const named = [...mains.map(([id]) => id), ...secondary];
	return {
		mains: mains.map(([id]) => id),
		secondary,
		weak,
		mastery: [
			...named.map((champion) => ({
				champion,
				value: value.get(champion) ?? fillerMastery,
			})),
			...weak.map((champion) => ({ champion, value: fillerMastery })),
		],
	};
}

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

function build(snapshot: RealSnapshot) {
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
	const strength = leagueStrength[snapshot.league.id] ?? 1;

	const make = (
		id: string,
		team: string,
		role: Role,
		extra: { name?: string; sub?: boolean; placeholder?: true },
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
		const { attributes, estimated } = profileOf(id, role);
		const level = Math.round(
			PLAYER_ATTRIBUTES.reduce((sum, key) => sum + attributes[key], 0) /
				PLAYER_ATTRIBUTES.length,
		);
		return {
			games: lines.length,
			row: {
				id,
				team,
				role,
				...(extra.name ? { name: extra.name } : {}),
				...(extra.sub !== undefined ? { sub: extra.sub } : {}),
				...(estimated.length ? { estimated } : {}),
				...(extra.placeholder ? { placeholder: true as const } : {}),
				level,
				...pool(champions, pools(role)),
				attributes,
				leader: false,
			},
		};
	};

	const members = snapshot.seasonPlayers.flatMap((player) => {
		const seen = [
			...groupBy(rolesByPlayer.get(player.id) ?? [], (line) => line.role ?? ""),
		].sort((a, b) => b[1].length - a[1].length || compare(a[0], b[0]))[0]?.[0];
		const role = player.role ?? roles.find((r) => r === seen);
		return role
			? [
					{
						team: player.team,
						...make(player.id, player.team, role, {
							name: player.name,
							sub: player.sub,
						}),
					},
				]
			: [];
	});

	const games = (id: string) =>
		snapshot.games.filter((game) => game.teams.some((t) => t.id === id));
	const teams = snapshot.teams.map((team: Team) => {
		const played = games(team.id);
		const wins = played.filter((game) => game.winner === team.id).length;
		const roster = members.filter((member) => member.team === team.id);
		for (const role of roles) {
			if (!roster.some((member) => member.row.role === role))
				roster.push({
					team: team.id,
					...make(`${team.id}-${role}`, team.id, role, { placeholder: true }),
				});
		}
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
			(member.row.attributes.shotcalling === best.row.attributes.shotcalling &&
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
		const rate = Math.round(((wins + 6) * 10_000) / (played.length + 12));
		return {
			score: rate * Math.round(strength * 100),
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

export function buildPlayerTeamContent(snapshots: readonly RealSnapshot[]) {
	const built = snapshots.flatMap(build);
	const ids = new Set<string>();
	for (const { team, players } of built) {
		for (const id of [team.id, ...players.map((p) => p.id)]) {
			if (ids.has(id)) throw new Error(`Duplicate id across leagues: ${id}`);
			ids.add(id);
		}
	}
	// One global order: win rate (smoothed) weighted by league strength.
	built.sort((a, b) => b.score - a.score || compare(a.team.id, b.team.id));
	const teams = built.map(({ team }, index) => ({ ...team, seed: index + 1 }));
	const players = built.flatMap(({ players: rows }) => rows);
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
