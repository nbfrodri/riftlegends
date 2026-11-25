import type { StageOutcomes } from "./qualification";
import { type StageNode, stageKey } from "./stage-model";
import {
	type Criterion,
	type Explanation,
	type Fixture,
	orderTies,
	type SeriesResult,
	type TiebreakContext,
} from "./tiebreak";

export type { Criterion, SeriesResult };

interface StandingRow {
	readonly team: string;
	readonly rank: number;
	readonly seriesWins: number;
	readonly seriesLosses: number;
	readonly gameWins: number;
	readonly gameLosses: number;
	readonly explanation: Explanation;
}

export interface StandingsInput
	extends Omit<TiebreakContext, "tiebreakerResults"> {
	/** Team ids in seed order, best first. */
	readonly teams: readonly string[];
	/** Opponents outside the ranked table, for cross-group play. */
	readonly opponents?: readonly string[];
	readonly tiebreakerResults?: readonly SeriesResult[];
}

type StageStandingsInput = Omit<
	StandingsInput,
	"criteria" | "scope" | "priorSplitRanks"
> & {
	readonly season: number;
};

export function computeStageStandings(
	node: StageNode,
	outcomes: StageOutcomes,
	input: StageStandingsInput,
): Standings {
	const priorSplitRanks = (node.stage.tiebreakHistory ?? []).flatMap(
		(stage) => {
			const table = outcomes.get(stageKey({ ...node.ref, stage }))?.standings;
			return table && table.pending.length === 0
				? [new Map(table.rows.map(({ team, rank }) => [team, rank]))]
				: [];
		},
	);
	const { season, ...standings } = input;
	return computeStandings({
		...standings,
		criteria: node.tiebreak,
		priorSplitRanks,
		scope: {
			competition: node.competitionIndex,
			stage: node.stageIndex,
			season,
		},
	});
}

export interface Standings {
	readonly rows: StandingRow[];
	/**
	 * Tiebreaker series still to play, in seed order. While any is pending the
	 * tied teams are in seed order and their explanation is `none`.
	 */
	readonly pending: Fixture[];
}

function check(
	teams: ReadonlySet<string>,
	results: readonly SeriesResult[],
): void {
	for (const { a, b, winsA, winsB } of results) {
		if (!teams.has(a) || !teams.has(b) || a === b) {
			throw new RangeError(`Unknown teams in series ${a} vs ${b}`);
		}
		if (
			!Number.isInteger(winsA) ||
			!Number.isInteger(winsB) ||
			winsA < 0 ||
			winsB < 0 ||
			winsA === winsB
		) {
			throw new RangeError(`Series ${a} vs ${b} needs a winner`);
		}
	}
}

/**
 * Ranks the teams by the competition's criteria, in order. A tie is settled
 * by the first criterion that separates its teams; when one separates only
 * some of them, each remaining tie starts again from the first criterion. A
 * tie that straddles a cut needs a tiebreaker series (`pending` until played);
 * anything left is drawn with the `competition` RNG stream. Every row says
 * which criterion placed the team.
 */
export function computeStandings(input: StandingsInput): Standings {
	const all = [...input.teams, ...(input.opponents ?? [])];
	const known = new Set(all);
	if (known.size !== all.length) {
		throw new RangeError("Team ids must be unique");
	}
	const tiebreakerResults = input.tiebreakerResults ?? [];
	check(known, input.results);
	check(new Set(input.teams), tiebreakerResults);

	const { order, explanations, pending } = orderTies(input.teams, {
		...input,
		tiebreakerResults,
	});

	const tally = new Map(
		all.map((team) => [
			team,
			{ seriesWins: 0, seriesLosses: 0, gameWins: 0, gameLosses: 0 },
		]),
	);
	for (const { a, b, winsA, winsB } of input.results) {
		const first = tally.get(a);
		const second = tally.get(b);
		if (first === undefined || second === undefined) continue;
		first.gameWins += winsA;
		first.gameLosses += winsB;
		second.gameWins += winsB;
		second.gameLosses += winsA;
		const [won, lost] = winsA > winsB ? [first, second] : [second, first];
		won.seriesWins += 1;
		lost.seriesLosses += 1;
	}

	return {
		pending,
		rows: order.map((team, index) => ({
			team,
			rank: index + 1,
			...(tally.get(team) as NonNullable<ReturnType<typeof tally.get>>),
			explanation: explanations.get(team) as Explanation,
		})),
	};
}
