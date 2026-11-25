import { shuffle } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";

export type Criterion =
	| "seriesWins"
	| "gameDiff"
	| "headToHead"
	| "gameWins"
	| "tiebreakerSeries"
	| "draw";

/** A finished series by team id and games won by each side. Order carries no meaning. */
export interface SeriesResult {
	readonly a: string;
	readonly b: string;
	readonly winsA: number;
	readonly winsB: number;
}

/**
 * Why a team sits where it does: the criterion that placed it, the teams it
 * was tied with (all of them, itself included) and each one's value. `none`
 * with teams in `tied` means a tiebreaker series is still pending.
 */
export interface Explanation {
	readonly criterion: Criterion | "none";
	readonly tied: readonly string[];
	readonly values: Readonly<Record<string, number>>;
}

export interface Fixture {
	readonly a: string;
	readonly b: string;
}

export interface TiebreakContext {
	readonly results: readonly SeriesResult[];
	readonly tiebreakerResults: readonly SeriesResult[];
	readonly criteria: readonly Criterion[];
	/** Number of teams that pass each cut: a cut of 2 splits places 2 and 3. */
	readonly cuts: readonly number[];
	readonly rootSeed: number;
	readonly scope: {
		readonly competition: number;
		readonly season: number;
		readonly stage: number;
	};
}

/** Round index of the final draw, apart from the rounds Swiss and fixtures use. */
const DRAW_ROUND = 0xfffffffe;

const winnerOf = (series: SeriesResult) =>
	series.winsA > series.winsB ? series.a : series.b;

/** Series won inside the group (everything when `group` is omitted), per team. */
function seriesWins(
	results: readonly SeriesResult[],
	teams: readonly string[],
	group?: ReadonlySet<string>,
): Map<string, number> {
	const wins = new Map(teams.map((team) => [team, 0]));
	for (const series of results) {
		if (group && !(group.has(series.a) && group.has(series.b))) continue;
		const winner = winnerOf(series);
		wins.set(winner, (wins.get(winner) ?? 0) + 1);
	}
	return wins;
}

function games(
	results: readonly SeriesResult[],
	teams: readonly string[],
): { won: Map<string, number>; lost: Map<string, number> } {
	const won = new Map(teams.map((team) => [team, 0]));
	const lost = new Map(teams.map((team) => [team, 0]));
	for (const { a, b, winsA, winsB } of results) {
		won.set(a, (won.get(a) ?? 0) + winsA);
		lost.set(a, (lost.get(a) ?? 0) + winsB);
		won.set(b, (won.get(b) ?? 0) + winsB);
		lost.set(b, (lost.get(b) ?? 0) + winsA);
	}
	return { won, lost };
}

const samePair = (series: SeriesResult, x: string, y: string) =>
	(series.a === x && series.b === y) || (series.a === y && series.b === x);

/** Orders a tied group by the criteria and says why; `pending` lists series still to play. */
export function orderTies(
	teams: readonly string[],
	ctx: TiebreakContext,
): {
	order: string[];
	explanations: Map<string, Explanation>;
	pending: Fixture[];
} {
	const explanations = new Map<string, Explanation>(
		teams.map((team) => [
			team,
			{ criterion: "none", tied: [], values: {} } as Explanation,
		]),
	);
	const pending: Fixture[] = [];
	const total = games(ctx.results, teams);

	const straddlesCut = (start: number, size: number) =>
		ctx.cuts.some((cut) => start < cut && cut < start + size);

	const settle = (
		members: readonly string[],
		criterion: Criterion,
		values: ReadonlyMap<string, number>,
		tied: readonly string[],
	) => {
		const shown = Object.fromEntries(
			tied.map((id) => [id, values.get(id) ?? 0]),
		);
		for (const id of members) {
			explanations.set(id, { criterion, tied, values: shown });
		}
	};

	/** Splits a group by a value, best first. Returns null when nobody is separated. */
	const split = (
		group: readonly string[],
		criterion: Criterion,
		values: ReadonlyMap<string, number>,
	): string[][] | null => {
		const distinct = [...new Set(group.map((id) => values.get(id) ?? 0))].sort(
			(x, y) => y - x,
		);
		if (distinct.length === 1) return null;
		const parts = distinct.map((value) =>
			group.filter((id) => (values.get(id) ?? 0) === value),
		);
		for (const part of parts) {
			if (part.length === 1) settle(part, criterion, values, group);
		}
		return parts;
	};

	const draw = (group: readonly string[], start: number): string[] => {
		const rng = createRng(
			deriveSeed(
				ctx.rootSeed,
				SCOPES.competition,
				ctx.scope.competition,
				ctx.scope.season,
				ctx.scope.stage,
				DRAW_ROUND,
				start,
			),
		);
		const order = shuffle(rng, group);
		const values = new Map(order.map((id, index) => [id, index + 1]));
		for (const id of order) settle([id], "draw", values, group);
		return order;
	};

	const resolve = (group: readonly string[], start: number): string[] => {
		if (group.length === 1) return [...group];
		const members = new Set(group);
		for (const criterion of ctx.criteria) {
			let values: ReadonlyMap<string, number>;
			if (criterion === "draw") {
				return draw(group, start);
			}
			if (criterion === "tiebreakerSeries") {
				if (!straddlesCut(start, group.length)) continue;
				const fixtures = group.flatMap((a, i) =>
					group.slice(i + 1).map((b) => ({ a, b })),
				);
				const unplayed = fixtures.filter(
					({ a, b }) =>
						!ctx.tiebreakerResults.some((series) => samePair(series, a, b)),
				);
				if (unplayed.length > 0) {
					pending.push(...unplayed);
					for (const id of group) {
						explanations.set(id, {
							criterion: "none",
							tied: group,
							values: {},
						});
					}
					return [...group];
				}
				values = seriesWins(ctx.tiebreakerResults, group, members);
			} else if (criterion === "headToHead") {
				values = seriesWins(ctx.results, group, members);
			} else if (criterion === "seriesWins") {
				values = seriesWins(ctx.results, teams);
			} else if (criterion === "gameWins") {
				values = total.won;
			} else {
				values = new Map(
					group.map((id) => [
						id,
						(total.won.get(id) ?? 0) - (total.lost.get(id) ?? 0),
					]),
				);
			}
			const parts = split(group, criterion, values);
			if (parts === null) continue;
			// A partial split sends each remaining tie back to the first criterion.
			let offset = start;
			const order: string[] = [];
			for (const part of parts) {
				order.push(...resolve(part, offset));
				offset += part.length;
			}
			return order;
		}
		return draw(group, start);
	};

	return { order: resolve(teams, 0), explanations, pending };
}
