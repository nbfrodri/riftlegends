import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { compare } from "./queries.ts";

type Snapshot = Pick<RealSnapshot, "rosters" | "seasonPlayers" | "games">;
type Entry = RealSnapshot["rosters"][number]["players"][number];

// MediaWiki titles are case-sensitive after the first letter, so the same
// person can reach us as `Xyno` and `xyno`, or with two spellings of the
// disambiguator, or as a look-alike alias (`BrokenBIade` for `BrokenBlade`,
// capital I for l, 0 for o). Those are different ids but one human: ids that
// share a handle (ignoring case, look-alikes and the `~fingerprint`) on the
// same team are merged.
const handleOf = (id: string) =>
	(id.split("~")[0] ?? id).replace(/I/g, "l").toLowerCase().replace(/0/g, "o");

export function mergeSamePlayers<T extends Snapshot>(snapshots: T[]): T[] {
	const games = new Map<string, number>();
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		const up = parent.get(id) ?? id;
		if (up === id) return id;
		const root = find(up);
		parent.set(id, root);
		return root;
	};
	const firstOnTeam = new Map<string, string>();
	const see = (id: string, team: string) => {
		if (!parent.has(id)) parent.set(id, id);
		const key = `${team}\u0000${handleOf(id)}`;
		const other = firstOnTeam.get(key);
		if (other === undefined) firstOnTeam.set(key, id);
		else parent.set(find(id), find(other));
	};
	for (const snapshot of snapshots) {
		for (const game of snapshot.games)
			for (const { player, team } of game.lines) {
				see(player, team);
				games.set(player, (games.get(player) ?? 0) + 1);
			}
		for (const roster of snapshot.rosters)
			for (const { id } of [...roster.players, ...roster.coaches])
				see(id, roster.team);
		for (const row of snapshot.seasonPlayers) see(row.id, row.team);
	}
	// Most games first; ties go to the lexicographic order.
	const canonical = new Map<string, string>();
	for (const id of [...parent.keys()].sort(compare)) {
		const root = find(id);
		const best = canonical.get(root);
		if (best === undefined || (games.get(id) ?? 0) > (games.get(best) ?? 0))
			canonical.set(root, id);
	}
	const rename = (id: string) => canonical.get(find(id)) ?? id;

	function join<E extends { id: string }>(
		rows: readonly E[],
		combine: (rows: E[], id: string) => E,
	) {
		const groups = new Map<string, E[]>();
		for (const row of rows) {
			const id = rename(row.id);
			groups.set(id, [...(groups.get(id) ?? []), row]);
		}
		return [...groups]
			.map(([id, group]) => combine(group, id))
			.sort((a, b) => compare(a.id, b.id));
	}
	const mergePlayers = <E extends Entry>(group: E[], id: string): E => {
		const base = group.find((row) => row.id === id) ?? (group[0] as E);
		const role = base.role ?? group.find((row) => row.role)?.role;
		const merged = {
			...base,
			id,
			role,
			sub: group.every((row) => row.sub),
			noGames: group.every((row) => row.noGames) ? true : undefined,
		} as E;
		for (const key of ["role", "noGames"] as const)
			if (merged[key] === undefined) delete merged[key];
		return merged;
	};

	return snapshots.map((snapshot) => ({
		...snapshot,
		games: snapshot.games.map((game) => ({
			...game,
			lines: game.lines.map((line) => ({
				...line,
				player: rename(line.player),
			})),
		})),
		rosters: snapshot.rosters.map((roster) => ({
			...roster,
			players: join(roster.players, mergePlayers),
			coaches: join(roster.coaches, (group, id) => ({
				...(group.find((row) => row.id === id) ?? (group[0] as never)),
				id,
			})),
		})),
		seasonPlayers: join(snapshot.seasonPlayers, mergePlayers),
	}));
}
