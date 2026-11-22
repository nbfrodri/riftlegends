import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import {
	field,
	groupBy,
	key,
	orderBy,
	person,
	type ResolveTeam,
	required,
	roleOf,
} from "./normalization.ts";
import type { SourceData } from "./queries.ts";

type Game = RealSnapshot["games"][number];
type Roster = RealSnapshot["rosters"][number];
type Player = Roster["players"][number];
type Coach = Roster["coaches"][number];
type Identity = Pick<Player, "id" | "name" | "role">;
type Appearance = Identity & {
	team: string;
	tournament: string;
	date: string;
	game: string;
};

function playerEntry(
	identity: Identity,
	games: readonly Game[],
	appearances: readonly Appearance[],
): Player {
	const role = identity.role ?? appearances.at(-1)?.role;
	const starts = new Set(
		appearances.filter((item) => item.role === role).map((item) => item.game),
	).size;
	return {
		id: identity.id,
		name: identity.name,
		role,
		sub: starts * 2 <= games.length,
		noGames: appearances.length ? undefined : true,
	};
}

export function normalizeRosters(
	source: SourceData,
	games: Game[],
	names: ReadonlyMap<string, string>,
	tournaments: ReadonlyMap<string, RealSnapshot["tournaments"][number]>,
	resolveTeam: ResolveTeam,
) {
	const entries = new Map<
		string,
		{
			team: string;
			tournament: string;
			players: Map<string, Identity>;
			coaches: Map<string, Coach>;
		}
	>();
	function roster(tournament: string, team: string) {
		const rosterKey = key(tournament, team);
		const previous = entries.get(rosterKey);
		if (previous) return previous;
		const entry = {
			team,
			tournament,
			players: new Map<string, Identity>(),
			coaches: new Map<string, Coach>(),
		};
		entries.set(rosterKey, entry);
		return entry;
	}

	const ignoredRoles = new Set<string>();
	let missingRosterLinks = 0;
	const order = (item: Appearance) =>
		key(item.date, item.game, item.team, item.role ?? "");
	const teamGames = new Map<string, Game[]>();
	const tournamentGames = new Map<string, Game[]>();
	const appearances: Appearance[] = [];
	for (const game of games) {
		for (const { id: team } of game.teams) {
			roster(game.tournament, team);
			const season = teamGames.get(team) ?? [];
			season.push(game);
			teamGames.set(team, season);
			const group = key(game.tournament, team);
			const local = tournamentGames.get(group) ?? [];
			local.push(game);
			tournamentGames.set(group, local);
		}
		for (const line of game.lines) {
			const name = names.get(line.player);
			if (!name) throw new Error(`Missing handle: ${line.player}`);
			appearances.push({
				id: line.player,
				name,
				role: line.role,
				team: line.team,
				tournament: game.tournament,
				date: game.date,
				game: game.id,
			});
		}
	}
	const byPlayer = groupBy(orderBy(appearances, order), (item) => item.id);
	const byRosterPlayer = groupBy(orderBy(appearances, order), (item) =>
		key(item.tournament, item.team, item.id),
	);
	for (const rows of byRosterPlayer.values()) {
		const last = rows.at(-1);
		if (last) roster(last.tournament, last.team).players.set(last.id, last);
	}

	const rosterRows = orderBy(source.roster, (row) =>
		key(
			row.OverviewPage ?? "",
			row.Team ?? "",
			row.Link ?? "",
			row.Player ?? "",
			row.Role ?? "",
		),
	);
	for (const row of rosterRows) {
		const link = field(row, "Link");
		if (!link) {
			missingRosterLinks++;
			continue;
		}
		const labels =
			field(row, "Role")
				?.split(",")
				.map((role) => role.trim()) ?? [];
		const coaching = labels.filter((role) =>
			role.toLowerCase().includes("coach"),
		);
		const position = labels.map(roleOf).find((role) => role !== undefined);
		const playing =
			position !== undefined ||
			labels.length === 0 ||
			labels.some((role) => /^(sub(stitute)?|player|flex)$/i.test(role));
		for (const label of labels) {
			if (
				!coaching.includes(label) &&
				!roleOf(label) &&
				!/^(sub(stitute)?|player|flex)$/i.test(label)
			) {
				ignoredRoles.add(label);
			}
		}
		if (!playing && coaching.length === 0) continue;
		const member = person(link, field(row, "Player"));
		const entry = roster(
			required(row, "OverviewPage"),
			resolveTeam(required(row, "Team")),
		);
		if (coaching.length)
			entry.coaches.set(member.id, { ...member, role: coaching.join(", ") });
		if (playing) {
			const previous = entry.players.get(member.id);
			entry.players.set(member.id, {
				...member,
				role: previous?.role ?? position,
			});
		}
	}
	const rosterHistory = new Map<
		string,
		{ member: Player; team: string; tournament: string }[]
	>();
	const rosters: Roster[] = [];
	for (const entry of orderBy([...entries.values()], (item) =>
		key(item.tournament, item.team),
	)) {
		const group = key(entry.tournament, entry.team);
		const players = orderBy(
			[...entry.players.values()],
			(member) => member.id,
		).map((member) => {
			const rows =
				byRosterPlayer.get(key(entry.tournament, entry.team, member.id)) ?? [];
			const result = playerEntry(
				member,
				tournamentGames.get(group) ?? [],
				rows,
			);
			const history = rosterHistory.get(member.id) ?? [];
			history.push({
				member: result,
				team: entry.team,
				tournament: entry.tournament,
			});
			rosterHistory.set(member.id, history);
			return result;
		});
		const coaches = orderBy([...entry.coaches.values()], (member) => member.id);
		rosters.push({
			tournament: entry.tournament,
			team: entry.team,
			players,
			coaches,
		});
	}

	const seasonPlayers = new Map<string, RealSnapshot["seasonPlayers"]>();
	let transfers = 0;
	for (const id of [...rosterHistory.keys()].sort()) {
		const rows = byPlayer.get(id) ?? [];
		const last = rows.at(-1);
		const preferred = orderBy(rosterHistory.get(id) ?? [], (record) => {
			const tournament = tournaments.get(record.tournament);
			return key(
				tournament?.endsOn ?? tournament?.startsOn ?? "",
				record.tournament,
				record.team,
			);
		}).at(-1);
		const team = last?.team ?? preferred?.team;
		const tournament = last?.tournament ?? preferred?.tournament;
		const identity = last ?? preferred?.member;
		if (!team || !tournament || !identity) continue;
		if (new Set(rows.map((row) => row.team)).size > 1) transfers++;
		const member = playerEntry(
			identity,
			teamGames.get(team) ?? [],
			rows.filter((row) => row.team === team),
		);
		const current = seasonPlayers.get(tournament) ?? [];
		current.push({ ...member, team });
		seasonPlayers.set(tournament, current);
	}
	return {
		rosters,
		seasonPlayers,
		oddities: {
			transfers,
			ignoredRoles: [...ignoredRoles].sort(),
			missingRosterLinks,
		},
	};
}
