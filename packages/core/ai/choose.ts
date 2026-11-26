import type { AiSettings } from "@rift-legends/contracts";
import { abs, type Fixed, max, mul, SCALE } from "../math";
import { int, weighted } from "../rng/helpers";
import type { Rng } from "../rng/streams";
import type { Component } from "./context";
import type { Profile } from "./profiles";

export interface Scored {
	readonly champion: string;
	readonly components: readonly Component[];
}

export type Difficulty = "easy" | "normal" | "hard";

/** Multiplier per component key; missing keys weigh ×1. */
export type Weights = Readonly<Partial<Record<string, Fixed>>>;

export interface Decision {
	readonly champion: string;
	readonly total: number;
	readonly components: readonly Component[];
	readonly alternatives: readonly {
		champion: string;
		total: number;
		chance: number;
	}[];
}

/** Plan 07: how each difficulty chooses. Temperature is in points. */
export const DIFFICULTY = {
	easy: {
		pool: 5,
		temperature: 35_000,
		wildcard: 500,
		lookahead: 0,
		readsRival: false,
	},
	normal: {
		pool: 3,
		temperature: 20_000,
		wildcard: 500,
		lookahead: 1,
		readsRival: true,
	},
	hard: {
		pool: 2,
		temperature: 9_000,
		wildcard: 0,
		lookahead: 2,
		readsRival: true,
	},
} as const satisfies Record<Difficulty, unknown>;

/** The wildcard picks uniformly among the candidates just outside the pool, up to this rank. */
const WILDCARD_REACH = 7;

/** e^(−x/4) × 1000 for x = 0, 1, 2…: weights by distance to the best, in quarters of temperature. */
const DECAY = [
	1000, 779, 607, 472, 368, 287, 223, 174, 135, 105, 82, 64, 50, 39, 30, 24, 18,
	14, 11, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1,
];

/** The coach decides; without a coach, the configured difficulty, else normal. */
export const difficultyOf = (settings: AiSettings): Difficulty => {
	const { coachRating } = settings;
	if (coachRating === undefined) return settings.difficulty ?? "normal";
	if (coachRating < 25) return "easy";
	return coachRating < 40 ? "normal" : "hard";
};

const weigh = (scored: Scored, weights: Weights) => {
	const components = scored.components
		.map(({ key, points }) => ({
			key,
			points: mul(points as Fixed, weights[key] ?? (SCALE as Fixed)),
		}))
		.filter((c) => c.points !== 0)
		.sort((a, b) => abs(b.points) - abs(a.points) || (a.key < b.key ? -1 : 1));
	const total = components.reduce((sum, c) => sum + c.points, 0);
	return { champion: scored.champion, components, total };
};

/** The weighted total of a candidate, without building its breakdown. */
const weightedTotal = ({ components }: Scored, weights: Weights) => {
	let total = 0;
	for (const { key, points } of components)
		total += mul(points as Fixed, weights[key] ?? (SCALE as Fixed));
	return total;
};

/**
 * The first `count` candidates by weighted total (ties by id) with their
 * breakdown. Only these are ever read, so the rest are not weighed in full.
 */
const topRanked = (
	candidates: readonly Scored[],
	weights: Weights,
	count: number,
) => {
	const top: { index: number; total: number }[] = [];
	const before = (a: { index: number; total: number }, b: typeof a) =>
		a.total > b.total ||
		(a.total === b.total &&
			(candidates[a.index] as Scored).champion <
				(candidates[b.index] as Scored).champion);
	for (let index = 0; index < candidates.length; index++) {
		const entry = {
			index,
			total: weightedTotal(candidates[index] as Scored, weights),
		};
		if (top.length === count && !before(entry, top[count - 1] as typeof entry))
			continue;
		let at = top.length;
		while (at > 0 && before(entry, top[at - 1] as typeof entry)) at--;
		top.splice(at, 0, entry);
		if (top.length > count) top.pop();
	}
	return top.map(({ index }) => weigh(candidates[index] as Scored, weights));
};

const share = (part: number, whole: number) =>
	Number((BigInt(part) * 10_000n) / BigInt(whole));

/**
 * Picks among the best candidates (plan 07, C2): integer weights that fall
 * with the distance to the best, and now and then a wildcard just outside.
 */
export const choose = (
	rng: Rng,
	candidates: readonly Scored[],
	profile: Profile,
	difficulty: Difficulty,
): Decision => {
	if (candidates.length === 0)
		throw new RangeError("No candidates to choose from");
	const rules = DIFFICULTY[difficulty];
	const poolSize = max(1, rules.pool + profile.pool);
	const ranked = topRanked(
		candidates,
		profile.weights,
		max(poolSize, WILDCARD_REACH),
	);
	const temperature = mul(
		rules.temperature as Fixed,
		profile.temperature as Fixed,
	);
	const wildcard = mul(rules.wildcard as Fixed, profile.wildcard as Fixed);
	const pool = ranked.slice(0, poolSize);
	const best = pool[0]?.total ?? 0;
	const poolWeights = pool.map((c) => {
		const quarters = Number(
			(BigInt(best - c.total) * 4n) / BigInt(temperature),
		);
		return DECAY[quarters] ?? 0;
	});
	const sum = poolWeights.reduce((a, b) => a + b, 0);

	const outside = ranked.slice(poolSize, WILDCARD_REACH);
	const wild =
		wildcard > 0 && outside.length > 0 && int(rng, 0, 9_999) < wildcard;
	const chosen = wild
		? (outside[int(rng, 0, outside.length - 1)] as (typeof ranked)[number])
		: (pool[weighted(rng, poolWeights)] as (typeof ranked)[number]);

	const chanceOf = (champion: string) => {
		const index = pool.findIndex((c) => c.champion === champion);
		return index < 0 ? 0 : share(poolWeights[index] as number, sum);
	};
	return {
		champion: chosen.champion,
		total: chosen.total,
		components: chosen.components,
		alternatives: ranked
			.filter((c) => c.champion !== chosen.champion)
			.slice(0, 3)
			.map((c) => ({
				champion: c.champion,
				total: c.total,
				chance: chanceOf(c.champion),
			})),
	};
};
