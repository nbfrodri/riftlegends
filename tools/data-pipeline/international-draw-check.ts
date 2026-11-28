import type { BracketDraw, Competition } from "@rift-legends/contracts";
import { seedOrder } from "../../packages/core/competition/bracket.ts";
import { brokenRules } from "../../packages/core/competition/bracket-draw.ts";
import { sourcesOf } from "../../packages/core/competition/stage-model.ts";

// Plan 12 §6, SO13: R1 accepts the real first round of a drawn bracket when
// some way of seating the real teams in the entry places keeps the tiers,
// `meet` and every rule of `avoid`.

type Stage = Competition["stages"][number];
type SwissRecord = { w: number; l: number };

/** What earlier stages of the event left behind. */
export interface DrawContext {
	/** Winner and loser of each bracket series, by stage and match id. */
	readonly results: Map<string, Map<string, [string, string]>>;
	/** Swiss records by stage. */
	readonly records: Map<string, Map<string, SwissRecord>>;
	/** Pairs (sorted, joined by "|") that already met in the event. */
	readonly met: Set<string>;
}

/** Key of a pair of teams in `DrawContext.met`. */
export const metKey = (a: string, b: string) => [a, b].sort().join("|");

/** Teams whose record shares the standing `rank` (1-based), best record first. */
function atStanding(records: Map<string, SwissRecord>, rank: number): string[] {
	const ranked = [...records].sort(([, a], [, b]) => b.w - a.w || a.l - b.l);
	const at = ranked[rank - 1]?.[1];
	return at
		? ranked.filter(([, r]) => r.w === at.w && r.l === at.l).map(([t]) => t)
		: [];
}

/** Which teams can take each entry place, or the reason it cannot be told. */
function placeFilters(
	stage: Stage,
	context: DrawContext,
	regions: ReadonlyMap<string, string>,
): ((team: string) => boolean)[] | string {
	const filters: ((team: string) => boolean)[] = [];
	for (const source of sourcesOf(stage)) {
		if (source.kind === "qualified" && source.places) {
			for (const { league } of source.places)
				filters.push((team) => regions.get(team) === league);
		} else if (source.kind === "bracket") {
			const result = context.results.get(source.stage)?.get(source.match);
			if (!result) return `no result for ${source.stage} ${source.match}`;
			const team = source.result === "winner" ? result[0] : result[1];
			filters.push((t) => t === team);
		} else if (source.kind === "standing") {
			const records = context.records.get(source.stage);
			if (!records) return `no Swiss records for ${source.stage}`;
			for (let rank = source.from; rank <= source.to; rank++) {
				const teams = atStanding(records, rank);
				filters.push((team) => teams.includes(team));
			}
		} else if (source.kind === "fixed") {
			for (const team of source.teams) filters.push((t) => t === team);
		} else {
			return `${source.kind} entrants are not checked`;
		}
	}
	return filters;
}

/** True if every team of the first tier of each `meet` faces one of the second. */
function meets(
	draw: BracketDraw,
	tierOf: ReadonlyMap<string, number>,
	partner: ReadonlyMap<string, string>,
): boolean {
	const used = new Set<string>();
	for (const [a, b] of draw.meet) {
		for (const [team, tier] of tierOf) {
			if (tier !== a || used.has(team)) continue;
			const other = partner.get(team) as string;
			if (used.has(other) || tierOf.get(other) !== b) return false;
			used.add(team).add(other);
		}
	}
	return true;
}

/**
 * Problems of the real first round of a drawn stage. `seeds` holds the teams
 * by bracket seed, as the replay of the stage placed them.
 */
export function checkDraw(
	stage: Stage,
	draw: BracketDraw,
	seeds: readonly string[],
	context: DrawContext,
	regions: ReadonlyMap<string, string>,
): string[] {
	const line = seedOrder(seeds.length).map((seed) => seeds[seed - 1] as string);
	const partner = new Map<string, string>();
	for (let i = 0; i < line.length; i += 2) {
		const [a, b] = [line[i] as string, line[i + 1] as string];
		partner.set(a, b).set(b, a);
	}
	const filters = placeFilters(stage, context, regions);
	if (typeof filters === "string") return [`draw: ${filters}`];
	const tierOfPlace = new Map(
		draw.tiers.flatMap((places, i) => places.map((p) => [p, i + 1] as const)),
	);
	// Seat the teams in the entry places one by one until the tiers fit.
	const tierOf = new Map<string, number>();
	const taken = new Set<number>();
	const seat = (k: number): boolean => {
		const team = line[k];
		if (team === undefined) return meets(draw, tierOf, partner);
		for (const [index, accepts] of filters.entries()) {
			if (taken.has(index) || !accepts(team)) continue;
			taken.add(index);
			tierOf.set(team, tierOfPlace.get(index + 1) ?? 0);
			if (seat(k + 1)) return true;
			taken.delete(index);
		}
		tierOf.delete(team);
		return false;
	};
	const problems = seat(0)
		? []
		: ["draw: no seating of the real teams keeps the tiers and meet"];
	const missing = line.filter((team) => !regions.has(team));
	if (missing.length)
		return [...problems, `draw: no region for ${missing.join(", ")}`];
	const placed = line.map((team) => ({
		team,
		region: regions.get(team) as string,
	}));
	const broken = brokenRules(draw.avoid, placed, (a, b) =>
		context.met.has(metKey(a, b)),
	);
	return [...problems, ...broken.map((rule) => `draw breaks ${rule}`)];
}

/**
 * Problems of one real group of a stage drawn by pots (plan 12 §6, SO17): the
 * teams must fill the pots one each and share no league. The pots are the
 * consecutive runs of the entry places; a place is told apart by its league.
 */
export function checkGroupDraw(
	stage: Stage,
	teams: readonly string[],
	regions: ReadonlyMap<string, string>,
): string[] {
	const source = sourcesOf(stage).find(
		(s) => s.kind === "qualified" && s.group,
	);
	const draw = stage.draw;
	if (source?.kind !== "qualified" || !source.places || !draw) return [];
	if (!("pots" in draw)) return [];
	const size = source.places.length / draw.pots;
	const pots = Array.from({ length: draw.pots }, (_, pot) =>
		source.places?.slice(pot * size, (pot + 1) * size).map((p) => p.league),
	);
	const leagues = teams.map((team) => regions.get(team));
	const problems: string[] = [];
	const seat = (k: number, taken: Set<number>): boolean => {
		if (k === leagues.length) return true;
		for (const [pot, accepts] of pots.entries()) {
			if (taken.has(pot) || !accepts?.includes(leagues[k] as string)) continue;
			if (seat(k + 1, new Set(taken).add(pot))) return true;
		}
		return false;
	};
	if (!seat(0, new Set())) problems.push("draw breaks pots");
	if (draw.avoidSameLeague && new Set(leagues).size !== leagues.length)
		problems.push("draw breaks league");
	return problems;
}
