import type { AiContent, MatchContent } from "@rift-legends/contracts";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { championProfile } from "./curated-champions.ts";
import { orderBy } from "./normalization.ts";

type Champion = AiContent["champions"][number] & MatchContent["champions"][number];
type Game = RealSnapshot["games"][number];
type Position = Champion["positions"][number];
type Role = Position["role"];
const roles: readonly Role[] = ["top", "jungle", "mid", "bot", "support"];
const minimumPairGames = 20;
const tiers: readonly [number, Position["tier"]][] = [
	[70, "S+"], [45, "S"], [30, "A"], [10, "B"], [1, "C"],
];

export interface CatalogChampion {
	id: string;
	key: number;
	classes: string[];
}

interface Presence {
	picks: number;
	bans: number;
	roles: Map<Role, number>;
}

function positions(presence: Presence, games: number, fallback: readonly Role[], classFallback: boolean) {
	const { picks, bans } = presence;
	const observed = roles.flatMap((role): Position[] => {
		const rolePicks = presence.roles.get(role) ?? 0;
		if (rolePicks === 0 || rolePicks * 20 < picks) return [];
		const tier = tiers.find(([threshold]) =>
			100 * rolePicks * (picks + bans) >= threshold * picks * games,
		)?.[1] ?? "D";
		return [{ role, tier: classFallback ? "C" : tier }];
	});
	return observed.length
		? observed
		: fallback.map((role): Position => ({ role, tier: "C" }));
}

function teamPicks(game: Game, team: Game["teams"][number]) {
	const picks = new Map<string, Set<Role>>();
	for (const id of team.picks) {
		if (id) picks.set(id, new Set());
	}
	for (const line of game.lines) {
		if (line.team !== team.id || !line.champion) continue;
		const roles = picks.get(line.champion) ?? new Set<Role>();
		if (line.role) roles.add(line.role);
		picks.set(line.champion, roles);
	}
	return picks;
}

function onlyRole(candidates: ReadonlySet<Role>) {
	return candidates.size === 1 ? [...candidates][0] : undefined;
}

function inRole(picks: ReturnType<typeof teamPicks>, role: Role) {
	const candidates = [...picks].filter(([, roles]) => roles.has(role));
	const [id, roles] = candidates[0] ?? [];
	return candidates.length === 1 && roles?.size === 1 ? id : undefined;
}

type Pair<R> = { a: string; b: string; role: R; games: number; wins: number };

function recordPair<R extends Role | undefined>(
	pairs: Map<string, Pair<R>>, a: string, b: string, won: boolean, role: R,
) {
	const id = JSON.stringify([a, b, role]);
	const row = pairs.get(id) ?? { a, b, role, games: 0, wins: 0 };
	row.games++;
	if (won) row.wins++;
	pairs.set(id, row);
}

function recordAllies(
	pairs: Map<string, Pair<undefined>>, picks: ReturnType<typeof teamPicks>, won: boolean,
) {
	const ids = [...picks.keys()].sort();
	for (const [index, a] of ids.entries()) {
		for (const b of ids.slice(index + 1)) recordPair(pairs, a, b, won, undefined);
	}
}

function sampled<R>(pairs: Map<string, Pair<R>>, minimumSample: number) {
	return [...pairs.keys()].sort().flatMap((key) => {
		const row = pairs.get(key);
		return row && row.games >= minimumSample ? [row] : [];
	});
}

export function deriveChampionContent(
	catalog: readonly CatalogChampion[],
	games: readonly Game[],
	minimumSample = minimumPairGames,
) {
	if (!Number.isSafeInteger(minimumSample) || minimumSample < 1)
		throw new Error("Minimum pair sample must be a positive integer");
	const presence = new Map<string, Presence>(
		catalog.map(({ id }) => [id, { picks: 0, bans: 0, roles: new Map() }]),
	);
	function lookup(id: string) {
		const counts = presence.get(id);
		if (!counts) throw new Error(`Snapshot champion missing from catalog: ${id}`);
		return counts;
	}
	const opponents = new Map<string, Pair<Role>>();
	const allies = new Map<string, Pair<undefined>>();
	for (const game of games) {
		const [blue, red] = game.teams;
		const bluePicks = teamPicks(game, blue);
		const redPicks = teamPicks(game, red);
		const bans = new Set([...blue.bans, ...red.bans]);
		for (const id of bans) {
			if (id) lookup(id).bans++;
		}
		for (const picks of [bluePicks, redPicks]) {
			for (const [id, candidates] of picks) {
				const counts = lookup(id);
				counts.picks++;
				const role = onlyRole(candidates);
				if (role) counts.roles.set(role, (counts.roles.get(role) ?? 0) + 1);
			}
		}
		if (!game.winner) continue;
		const blueWon = game.winner === blue.id;
		recordAllies(allies, bluePicks, blueWon);
		recordAllies(allies, redPicks, !blueWon);
		for (const role of roles) {
			const a = inRole(bluePicks, role);
			const b = inRole(redPicks, role);
			if (!a || !b || a === b) continue;
			if (a < b) recordPair(opponents, a, b, blueWon, role);
			else recordPair(opponents, b, a, !blueWon, role);
		}
	}
	const estimated: string[] = [];
	const classFallbacks: string[] = [];
	const champions = orderBy(catalog, ({ id }) => id).map(({ id, classes }): Champion => {
		const { roles, damage, power, archetypes, cc, mobility, frontline, estimate } =
			championProfile(id, classes);
		if (estimate) estimated.push(id);
		const classFallback = estimate === "class";
		if (classFallback) classFallbacks.push(id);
		return {
			id, name: id,
			positions: positions(lookup(id), games.length, roles, classFallback),
			damage, power, archetypes: [...archetypes], cc, mobility, frontline,
		};
	});
	const matchups: AiContent["matchups"] = orderBy(
		sampled(opponents, minimumSample).flatMap(({ a, b, role, wins, games }) => {
			const value = Math.round((20 * wins - 10 * games) / games) || 0;
			return [
				{ champion: a, against: b, role, value },
				{ champion: b, against: a, role, value: -value || 0 },
			];
		}),
		({ champion, against, role }) => JSON.stringify([champion, against, role]),
	);
	const synergies: AiContent["synergies"] = sampled(allies, minimumSample).map(
		({ a, b, wins, games }) => ({
			a, b, value: Math.max(0, Math.round((12 * wins - 6 * games) / games)),
		}),
	);
	return { champions, matchups, synergies, estimated, classFallbacks, minimumSample };
}
