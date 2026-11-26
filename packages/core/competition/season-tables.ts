import type { BracketState } from "./bracket-state";
import { computeGroupStandings } from "./group-standings";
import { bracketOrder, type StageOutcomes } from "./qualification";
import type { SeasonFixture } from "./season-series";
import {
	type StageGraph,
	type StageNode,
	sourceRef,
	sourcesOf,
	stageKey,
} from "./stage-model";
import {
	computeStageStandings,
	type SeriesResult,
	type Standings,
} from "./standings";
import type { SwissTeam } from "./swiss";

export interface Played {
	readonly fixture: SeasonFixture;
	readonly winner: string;
	readonly result: SeriesResult & { readonly groupPoints: number };
}

function cutsFor(
	graph: StageGraph,
	node: StageNode,
	group?: "winner" | "loser",
) {
	const cuts = new Set<number>();
	for (const next of graph.nodes.values()) {
		for (const source of sourcesOf(next.stage)) {
			if (
				source.kind !== "standing" ||
				source.group !== group ||
				stageKey(sourceRef(source, next)) !== stageKey(node.ref)
			)
				continue;
			cuts.add(source.from - 1);
			cuts.add(source.to);
		}
	}
	if (!group) {
		for (const leagues of graph.awards.values()) {
			for (const rule of leagues.get(node.ref.competition) ?? []) {
				if (rule.stage.stage === node.ref.stage && rule.slot.rule !== "points")
					cuts.add(rule.slot.count);
			}
		}
	}
	return [...cuts];
}

export function stageTables(
	graph: StageGraph,
	node: StageNode,
	outcomes: StageOutcomes,
	entrants: readonly SwissTeam[],
	groups: readonly (readonly string[])[] | undefined,
	played: readonly Played[],
	rootSeed: number,
	season: number,
	final: boolean,
	bracket?: BracketState,
) {
	const input = {
		teams: entrants.map(({ id }) => id),
		results: played
			.filter(({ fixture }) => !fixture.tiebreaker)
			.map(({ result }) => result),
		tiebreakerResults: played
			.filter(({ fixture }) => fixture.tiebreaker)
			.map(({ result }) => result),
		rootSeed,
		season,
		cuts: final && !bracket ? cutsFor(graph, node) : [],
	};
	let standings = computeStageStandings(node, outcomes, input);
	if (!played.length) {
		// Before the first series nothing separates the teams: seed order, undrawn.
		const rows = new Map(standings.rows.map((row) => [row.team, row]));
		standings = {
			...standings,
			rows: input.teams.flatMap((team, index) => {
				const row = rows.get(team);
				return row
					? [
							{
								...row,
								rank: index + 1,
								explanation: {
									criterion: "none" as const,
									tied: [],
									values: {},
								},
							},
						]
					: [];
			}),
		};
	}
	const order = bracket && bracketOrder(bracket);
	if (order) {
		const rows = new Map(standings.rows.map((row) => [row.team, row]));
		const ordered = order.flatMap((team, index) => {
			const row = rows.get(team);
			return row
				? [
						{
							...row,
							rank: index + 1,
							explanation: { criterion: "none" as const, tied: [], values: {} },
						},
					]
				: [];
		});
		standings = { ...standings, rows: ordered };
	}
	const [left, right] = groups ?? [];
	const groupTables =
		left &&
		right &&
		node.stage.play.type === "groups" &&
		node.stage.play.seeding === "cross"
			? computeGroupStandings({
					...input,
					groups: [left, right],
					cuts: {
						winner: final ? cutsFor(graph, node, "winner") : [],
						loser: final ? cutsFor(graph, node, "loser") : [],
					},
					criteria: node.tiebreak,
					scope: {
						competition: node.competitionIndex,
						stage: node.stageIndex,
						season,
					},
				})
			: undefined;
	return {
		standings,
		...(bracket && { bracket }),
		...(groupTables && { groups: groupTables }),
		pending: [
			...standings.pending,
			...Object.values(groupTables ?? {}).flatMap(
				(table: Standings) => table.pending,
			),
		],
	};
}
