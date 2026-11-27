import { min } from "../math/int";
import { shuffle } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { assignGroups } from "./groups";
import { drawPots, type StageNode } from "./stage-model";

interface DrawTeam {
	readonly team: string;
	readonly league: string;
	readonly region: string;
}

const DRAW_ROUND = 0xfffffffd;

function split<T>(items: readonly T[], count: number): T[][] {
	const extra = items.length % count;
	const base = (items.length - extra) / count;
	return Array.from({ length: count }, (_, index) => {
		const start = index * base + min(index, extra);
		return items.slice(start, start + base + (index < extra ? 1 : 0));
	});
}

export function seedStage<T extends DrawTeam>(
	node: StageNode,
	teams: readonly T[],
	seed: number,
	season: number,
) {
	const count = drawPots(node);
	if (count === undefined)
		return teams.map((team, index) => ({
			...team,
			seed: index + 1,
		}));
	const rng = createRng(
		deriveSeed(
			seed,
			SCOPES.competition,
			node.competitionIndex,
			season,
			node.stageIndex,
			DRAW_ROUND,
		),
	);
	return split(teams, count)
		.flatMap((pot, index) =>
			shuffle(rng, pot).map((entry) => ({ ...entry, pot: index + 1 })),
		)
		.map((team, index) => ({ ...team, seed: index + 1 }));
}

const clashes = (a: DrawTeam, b: DrawTeam) =>
	a.league === b.league || a.region === b.region;

function collisions(group: readonly DrawTeam[]): number {
	return group.reduce(
		(count, a, i) =>
			count + group.slice(i + 1).filter((b) => clashes(a, b)).length,
		0,
	);
}

/** Keep the snake's pot quotas while looking for a clash-free allocation. */
function separate<T extends DrawTeam & { pot?: number }>(
	initial: T[][],
): T[][] {
	if (initial.every((group) => collisions(group) === 0)) return initial;
	const positions = initial.flatMap((group, g) =>
		group.map((entry, i) => ({ g, i, pot: entry.pot })),
	);
	const teams = initial.flat();
	const pools = new Map<number | undefined, T[]>();
	for (const entry of teams) {
		const pool = pools.get(entry.pot);
		if (pool) pool.push(entry);
		else pools.set(entry.pot, [entry]);
	}
	const placed: T[][] = initial.map(() => []);
	const used = new Set<T>();
	const available = (position: (typeof positions)[number]) =>
		(pools.get(position.pot) ?? []).filter(
			(entry) =>
				!used.has(entry) &&
				!placed[position.g]?.some((other) => clashes(entry, other)),
		);
	const earlier = new Set<(typeof positions)[number]>();
	const fill = (): boolean => {
		if (earlier.size === positions.length) return true;
		const remaining = positions.filter((position) => !earlier.has(position));
		const choices = remaining.map((position) => ({
			position,
			candidates: available(position),
		}));
		choices.sort((a, b) => a.candidates.length - b.candidates.length);
		const next = choices[0];
		if (!next) return false;
		const { position, candidates } = next;
		const group = placed[position.g] as T[];
		earlier.add(position);
		// Teams sharing both affiliations in a pot are interchangeable for this search.
		const tried = new Set<string>();
		for (const entry of candidates) {
			const affiliation = JSON.stringify([entry.league, entry.region]);
			if (tried.has(affiliation)) continue;
			tried.add(affiliation);
			used.add(entry);
			group.push(entry);
			if (fill()) return true;
			group.pop();
			used.delete(entry);
		}
		earlier.delete(position);
		return false;
	};
	const enoughGroups = (key: "league" | "region") => {
		const counts = new Map<string, number>();
		for (const team of teams) {
			const count = (counts.get(team[key]) ?? 0) + 1;
			if (count > initial.length) return false;
			counts.set(team[key], count);
		}
		return true;
	};
	if (enoughGroups("league") && enoughGroups("region") && fill()) return placed;

	// When a clean draw is impossible, keep pots fixed and reduce collisions.
	for (;;) {
		let best:
			| { a: T[]; b: T[]; i: number; j: number; gain: number }
			| undefined;
		for (const [g, a] of initial.entries()) {
			for (const b of initial.slice(g + 1)) {
				const before = collisions(a) + collisions(b);
				for (const [i, x] of a.entries()) {
					for (const [j, y] of b.entries()) {
						if (x.pot !== y.pot) continue;
						a[i] = y;
						b[j] = x;
						const gain = before - collisions(a) - collisions(b);
						a[i] = x;
						b[j] = y;
						if (gain > (best?.gain ?? 0)) best = { a, b, i, j, gain };
					}
				}
			}
		}
		if (!best) return initial;
		const { a, b, i, j } = best;
		const x = a[i] as T;
		a[i] = b[j] as T;
		b[j] = x;
	}
}

export function seedGroups<T extends DrawTeam & { pot?: number }>(
	node: StageNode,
	teams: readonly T[],
) {
	const { play, draw } = node.stage;
	if (play.type !== "groups") return { groups: undefined, relaxed: [] };
	if (play.seeding === "ranked")
		return {
			groups: split(
				teams.map((team) => team.team),
				play.count,
			),
			relaxed: [],
		};
	const byId = new Map(teams.map((team) => [team.team, team]));
	let groups = assignGroups(
		teams.map(({ team }) => ({ id: team })),
		{ count: play.count },
	).map((group) => group.map((id) => byId.get(id) as T));
	const avoid = (draw && "pots" in draw && draw.avoidSameLeague) ?? false;
	if (avoid) groups = separate(groups);
	const position = new Map(teams.map((entry, index) => [entry.team, index]));
	return {
		groups: groups.map((group) =>
			[...group]
				.sort(
					(a, b) =>
						(position.get(a.team) as number) - (position.get(b.team) as number),
				)
				.map((entry) => entry.team),
		),
		relaxed:
			avoid && groups.some((group) => collisions(group) > 0)
				? ["league" as const]
				: [],
	};
}
