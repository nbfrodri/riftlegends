import type { Competition } from "@rift-legends/contracts";
import { min } from "../math/int";
import type { BracketState } from "./bracket-state";
import {
	type AwardRule,
	type StageGraph,
	type StageRef,
	stageKey,
} from "./stage-model";
import type { Standings } from "./standings";

export interface StageOutcome {
	/** The final table, or a table with tiebreakers still pending. */
	readonly standings?: Pick<Standings, "rows" | "pending">;
	readonly groups?: Readonly<Record<"winner" | "loser", Standings>>;
	readonly bracket?: BracketState;
	/** Season points earned up through this stage, supplied by the league. */
	readonly points?: ReadonlyMap<string, number>;
	/** Series played in the stage: a later bracket draw avoids rematches. */
	readonly played?: readonly {
		readonly fixture: { readonly teams: readonly [string, string] };
	}[];
}

export type StageOutcomes = ReadonlyMap<string, StageOutcome>;

export interface Qualification {
	readonly kind: "qualified";
	readonly league: string;
	readonly stage: StageRef;
	readonly rule: NonNullable<Competition["slots"]>[number]["rule"];
	readonly place: number;
	readonly rank: number;
	readonly via: "direct" | "cascade";
	readonly skipped: readonly string[];
	readonly points?: number;
	readonly leagueSeed?: number;
}

interface Candidate {
	readonly team: string;
	readonly points?: number;
	readonly leagueSeed?: number;
}

export function bracketOrder(bracket: BracketState): string[] | undefined {
	if (bracket.champion === null) return undefined;
	const matches = bracket.matches.filter((m) => m.status === "done").reverse();
	const teams = [bracket.champion];
	// In a GSL group the winner of the lower final finishes second.
	const last = matches[0];
	if (last?.side === "lower" && last.winner !== null) teams.push(last.winner);
	for (const match of matches) {
		if (match.loser !== null) teams.push(match.loser);
	}
	return [...new Set(teams)];
}

function rankFor(
	graph: StageGraph,
	rule: AwardRule,
	outcome: StageOutcome,
): Candidate[] | undefined {
	if (rule.slot.rule === "points") {
		if (!outcome.points) return undefined;
		return [...outcome.points]
			.flatMap(([id, points]) => {
				const team = graph.teams.get(id);
				return team?.competition === rule.stage.competition
					? [{ team: id, points, leagueSeed: team.rank }]
					: [];
			})
			.sort(
				(a, b) =>
					b.points - a.points ||
					(a.leagueSeed ?? 0) - (b.leagueSeed ?? 0) ||
					(a.team < b.team ? -1 : a.team > b.team ? 1 : 0),
			);
	}
	const table = outcome.standings;
	if (table?.pending.length) return undefined;
	const order =
		table?.rows
			.slice()
			.sort((a, b) => a.rank - b.rank)
			.map((row) => row.team) ??
		(outcome.bracket && bracketOrder(outcome.bracket));
	if (!order) return undefined;
	const champion =
		rule.slot.rule === "stageWinner" ? outcome.bracket?.champion : undefined;
	if (rule.slot.rule === "stageWinner" && outcome.bracket && !champion)
		return undefined;
	const ranked = champion
		? [champion, ...order.filter((team) => team !== champion)]
		: order;
	return ranked.map((team) => ({ team }));
}

export function awardPlaces(
	graph: StageGraph,
	event: string,
	league: string,
	lastPlace: number,
	outcomes: StageOutcomes,
):
	| { places: ReadonlyMap<number, { team: string; source: Qualification }> }
	| { pending: StageRef[] } {
	const ready: { rule: AwardRule; order: Candidate[] }[] = [];
	const pending: StageRef[] = [];
	for (const rule of graph.awards.get(event)?.get(league) ?? []) {
		if (rule.firstPlace > lastPlace) break;
		const outcome = outcomes.get(stageKey(rule.stage));
		const order = outcome && rankFor(graph, rule, outcome);
		if (order) ready.push({ rule, order });
		else pending.push(rule.stage);
	}
	if (pending.length) return { pending };

	const places = new Map<number, { team: string; source: Qualification }>();
	const qualified = new Set<string>();
	for (const { rule, order } of ready) {
		let place = rule.firstPlace;
		const end = min(lastPlace + 1, place + rule.slot.count);
		const skipped: string[] = [];
		for (const [index, candidate] of order.entries()) {
			if (place >= end) break;
			const { team, points, leagueSeed } = candidate;
			if (qualified.has(team)) {
				if (rule.slot.cascade === "vacant") place++;
				else skipped.push(team);
				continue;
			}
			if (graph.teams.get(team)?.competition !== league) continue;
			qualified.add(team);
			places.set(place, {
				team,
				source: {
					kind: "qualified",
					league,
					stage: rule.stage,
					rule: rule.slot.rule,
					place,
					rank: index + 1,
					via: skipped.length ? "cascade" : "direct",
					skipped: [...skipped],
					...(points === undefined || leagueSeed === undefined
						? {}
						: { points, leagueSeed }),
				},
			});
			place++;
		}
	}
	return { places };
}
