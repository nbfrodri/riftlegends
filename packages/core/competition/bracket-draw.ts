import type { BracketDraw } from "@rift-legends/contracts";
import { shuffle } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng, type Rng } from "../rng/streams";
import { seedOrder } from "./bracket";
import type { StageOutcomes } from "./qualification";
import type { StageGraph, StageNode } from "./stage-model";
import { stageKey } from "./stage-model";

// First-round draw of an elimination bracket (plan 12 §6, #626). The draw
// only reorders the seed list: `bracket.ts` builds the same bracket as ever.

type DrawRule = BracketDraw["avoid"][number];

export interface BracketDrawRules {
	readonly tiers: readonly (readonly number[])[];
	readonly meet: readonly (readonly [number, number])[];
	readonly avoid: readonly DrawRule[];
}

export interface DrawEntrant {
	readonly team: string;
	readonly region: string;
	/** 1-based place in the entry list, which the tiers refer to. */
	readonly initialSeed: number;
}

export interface BracketDrawResult {
	/** Teams from the best seed down. */
	readonly order: string[];
	readonly tiers: { team: string; tier: number }[];
	/** First-round series in bracket order (1-8, 4-5, 2-7, 3-6), better seed first. */
	readonly pairs: [string, string][];
	/** Rules of `avoid` that the result breaks, in their order. */
	readonly relaxed: DrawRule[];
}

/** Search steps per attempt; a harder field is treated as impossible and relaxed. */
const SEARCH_BUDGET = 50_000;

type Met = (a: string, b: string) => boolean;
type Pair = readonly [DrawEntrant, DrawEntrant];

function search(
	n: number,
	rules: BracketDrawRules,
	tiers: readonly DrawEntrant[][],
	pool: readonly DrawEntrant[],
	slots: readonly number[],
	active: ReadonlySet<DrawRule>,
	met: Met,
): DrawEntrant[] | undefined {
	let budget = SEARCH_BUDGET;
	const halves = n >= 4 && active.has("regionHalf");
	const pairOk = (a: DrawEntrant, b: DrawEntrant) =>
		!(
			((halves || active.has("region")) && a.region === b.region) ||
			(active.has("rematch") && met(a.team, b.team))
		);
	const used = new Set<DrawEntrant>();
	const pairs: Pair[] = [];
	const line: (DrawEntrant | undefined)[] = Array(n);
	const halfOf = (slot: number) => (2 * slot < n / 2 ? 0 : 1);
	const fits = (pair: Pair, half: number) =>
		!halves ||
		!line.some(
			(team, position) =>
				team !== undefined &&
				(position < n / 2 ? 0 : 1) === half &&
				pair.some(({ region }) => region === team.region),
		);
	const place = (k: number): boolean => {
		const pair = pairs[k];
		if (!pair) return true;
		// Slots of the same half are alike for the rules: try the first free one of each.
		const tried = new Set<number>();
		for (const slot of slots) {
			const half = halfOf(slot);
			if (line[2 * slot] || tried.has(half)) continue;
			tried.add(half);
			if (--budget < 0 || !fits(pair, half)) continue;
			[line[2 * slot], line[2 * slot + 1]] = pair;
			if (place(k + 1)) return true;
			line[2 * slot] = line[2 * slot + 1] = undefined;
		}
		return false;
	};
	const next = (): [DrawEntrant, readonly DrawEntrant[]] | undefined => {
		for (const [a, b] of rules.meet) {
			const team = tiers[a - 1]?.find((entry) => !used.has(entry));
			if (team) return [team, tiers[b - 1] ?? []];
		}
		const team = pool.find((entry) => !used.has(entry));
		return team && [team, pool];
	};
	const pairUp = (): boolean => {
		const task = next();
		if (!task) return place(0);
		const [team, candidates] = task;
		used.add(team);
		for (const other of candidates) {
			if (used.has(other) || --budget < 0 || !pairOk(team, other)) continue;
			used.add(other);
			pairs.push([team, other]);
			if (pairUp()) return true;
			pairs.pop();
			used.delete(other);
		}
		used.delete(team);
		return false;
	};
	return pairUp() ? (line as DrawEntrant[]) : undefined;
}

type Placed = Pick<DrawEntrant, "team" | "region">;

function broken(rule: DrawRule, line: readonly Placed[], met: Met) {
	const n = line.length;
	return line.some((a, i) =>
		line.some((b, j) => {
			if (j <= i) return false;
			if (rule === "regionHalf")
				return n >= 4 && i < n / 2 === j < n / 2 && a.region === b.region;
			if (j !== i + 1 || i % 2) return false;
			return rule === "region" ? a.region === b.region : met(a.team, b.team);
		}),
	);
}

/**
 * Rules of `avoid` that a first round breaks. `line` holds the teams in
 * bracket order (1-8, 4-5, 2-7, 3-6): pairs side by side, halves split in two.
 */
export function brokenRules(
	avoid: readonly DrawRule[],
	line: readonly Placed[],
	met: Met,
): DrawRule[] {
	return avoid.filter((rule) => broken(rule, line, met));
}

/**
 * Shuffles every tier and the remaining pool with `rng`, then looks for the
 * first draw that keeps `avoid`; if there is none it drops the first rule and
 * tries again. Tiers and `meet` are never relaxed.
 */
export function drawBracket(
	rules: BracketDrawRules,
	teams: readonly DrawEntrant[],
	met: Met,
	rng: Rng,
): BracketDrawResult {
	const n = teams.length;
	const byPlace = new Map(teams.map((entry) => [entry.initialSeed, entry]));
	const tierOf = new Map<DrawEntrant, number>();
	const tiers = rules.tiers.map((places, index) =>
		shuffle(
			rng,
			places.map((place) => {
				const entry = byPlace.get(place);
				if (!entry) throw new RangeError(`No team in place ${place}`);
				tierOf.set(entry, index + 1);
				return entry;
			}),
		),
	);
	const pool = shuffle(rng, teams);
	const slots = shuffle(
		rng,
		Array.from({ length: n / 2 }, (_, slot) => slot),
	);
	let line: DrawEntrant[] | undefined;
	for (let skip = 0; !line; skip += 1) {
		const active = new Set(rules.avoid.slice(skip));
		line = search(n, rules, tiers, pool, slots, active, met);
	}
	// Swapping the two halves of any sub-bracket keeps every crossing: the better one
	// goes first, so the better tier (then entry place) holds the better seed.
	const key = (entry: DrawEntrant) =>
		(tierOf.get(entry) ?? 0) * 64 + entry.initialSeed;
	const canon = (part: DrawEntrant[]): DrawEntrant[] => {
		if (part.length < 2) return part;
		const left = canon(part.slice(0, part.length / 2));
		const right = canon(part.slice(part.length / 2));
		return key(left[0] as DrawEntrant) < key(right[0] as DrawEntrant)
			? [...left, ...right]
			: [...right, ...left];
	};
	const ordered = canon(line);
	const bySeed: DrawEntrant[] = Array(n);
	seedOrder(n).forEach((seed, position) => {
		bySeed[seed - 1] = ordered[position] as DrawEntrant;
	});
	return {
		order: bySeed.map(({ team }) => team),
		tiers: bySeed.map((entry) => ({
			team: entry.team,
			tier: tierOf.get(entry) ?? 0,
		})),
		pairs: Array.from({ length: n / 2 }, (_, i) => [
			(ordered[2 * i] as DrawEntrant).team,
			(ordered[2 * i + 1] as DrawEntrant).team,
		]),
		relaxed: brokenRules(rules.avoid, ordered, met),
	};
}

/** Teams that already met in another stage of the same competition. */
function rivalsBefore(
	graph: StageGraph,
	node: StageNode,
	outcomes: StageOutcomes,
): Met {
	const met = new Set<string>();
	for (const [key, other] of graph.nodes) {
		if (other.ref.competition !== node.ref.competition) continue;
		if (key === stageKey(node.ref)) continue;
		for (const { fixture } of outcomes.get(key)?.played ?? [])
			met.add(JSON.stringify([...fixture.teams].sort()));
	}
	return (a, b) => met.has(JSON.stringify([a, b].sort()));
}

/** The stage's bracket draw from its own `stageDraw` stream, if it has one. */
export function drawStage<T extends DrawEntrant>(
	graph: StageGraph,
	node: StageNode,
	teams: readonly T[],
	outcomes: StageOutcomes,
	rootSeed: number,
	season: number,
) {
	const rules = node.stage.draw;
	if (!rules || !("tiers" in rules)) return undefined;
	const rng = createRng(
		deriveSeed(
			rootSeed,
			SCOPES.stageDraw,
			node.competitionIndex,
			season,
			node.stageIndex,
		),
	);
	const { order, ...draw } = drawBracket(
		rules,
		teams,
		rivalsBefore(graph, node, outcomes),
		rng,
	);
	const byTeam = new Map(teams.map((entry) => [entry.team, entry]));
	return {
		entrants: order.map((team, index) => ({
			...(byTeam.get(team) as T),
			seed: index + 1,
		})),
		draw,
	};
}
