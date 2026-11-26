import type { CoreError } from "@rift-legends/contracts";
import { max, min } from "../math/int";
import { shuffle } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Emitted } from "../server/dispatcher";
import { resolveBracket } from "./bracket-state";
import type { CalendarStage } from "./calendar";
import { type FixtureSlot, stageFixtures } from "./calendar-fixtures";
import type { StageOutcome, StageOutcomes } from "./qualification";
import { drawGame1Priority } from "./round-robin";
import { resolveStage } from "./season";
import type { SeasonFixture } from "./season-series";
import { type Played, stageTables } from "./season-tables";
import { type StageGraph, type StageNode, stageKey } from "./stage-model";
import { pairSwissRound } from "./swiss";

export interface StageProgress extends StageOutcome {
	readonly played: readonly Played[];
	readonly fixtures: readonly SeasonFixture[];
	readonly standings: NonNullable<StageOutcome["standings"]>;
	readonly ties: readonly FixtureSlot[];
	readonly done: boolean;
}

function swissFixtures(
	node: StageNode,
	teams: Parameters<typeof pairSwissRound>[0],
	played: readonly Played[],
	seed: number,
	year: number,
): { fixtures: SeasonFixture[]; paired?: Emitted } {
	const play = node.stage.play;
	if (play.type !== "swiss") return { fixtures: [] };
	const byRound = new Map<number, { winner: string; loser: string }[]>();
	for (const { fixture, winner } of played) {
		if (fixture.tiebreaker) continue;
		const round = byRound.get(fixture.round) ?? [];
		const [a, b] = fixture.teams;
		round.push({ winner, loser: a === winner ? b : a });
		byRound.set(fixture.round, round);
	}
	const rules = {
		...play,
		maxRounds: min(
			play.maxRounds ?? play.wins + play.losses - 1,
			play.wins + play.losses - 1,
		),
	};
	const pairing = pairSwissRound(teams, [...byRound.values()], rules, seed, {
		competition: node.competitionIndex,
		stage: node.stageIndex,
		season: year,
	});
	if (!pairing) return { fixtures: [] };
	const { round, pairings, relaxed } = pairing;
	return {
		fixtures: pairings.map(({ a, b, bestOf, priority }, index) => ({
			id: `swiss-${round}-${index + 1}`,
			teams: [a, b],
			round,
			bestOf: bestOf as SeasonFixture["bestOf"],
			priority,
		})),
		paired: {
			type: "competition.paired",
			...node.ref,
			round,
			pairs: pairings.map(({ a, b }) => [a, b]),
			relaxed: relaxed.filter((rule) => rule !== "record"),
		},
	};
}

export function advanceStage(
	graph: StageGraph,
	node: StageNode,
	outcomes: StageOutcomes,
	calendar: CalendarStage,
	previous: StageProgress | undefined,
	played: readonly Played[],
	seed: number,
	year: number,
	tiebreakerBestOf: SeasonFixture["bestOf"],
): { progress?: StageProgress; paired?: Emitted; error?: CoreError } {
	const resolved = resolveStage(graph, node.ref, outcomes, seed, year);
	if (resolved.status === "pending") return {};
	if (resolved.status === "error") return { error: resolved.error };
	const entrants = resolved.entrants.map(({ team: id, league, region }) => ({
		id,
		league,
		region,
	}));
	const registered = new Set(played.map(({ fixture }) => fixture.id));
	const play = node.stage.play;
	const bracket =
		node.bracket &&
		resolveBracket(
			node.bracket,
			entrants.map(({ id }) => id),
			Object.fromEntries(
				played.map(({ fixture, winner }) => [fixture.id, winner]),
			),
		);
	let fixtures: SeasonFixture[] = [];
	let paired: Emitted | undefined;
	const scope = {
		competition: node.competitionIndex,
		stage: node.stageIndex,
		season: year,
	};
	const priorityFor = (
		[a, b]: readonly [string, string],
		round: number,
		index: number,
	) => drawGame1Priority(seed, { ...scope, round }, [{ a, b }], index)[0] ?? a;
	if (bracket) {
		fixtures = bracket.matches.flatMap(
			({ id, teamA, teamB, round, bestOf, priority, status }) =>
				status === "ready" && teamA !== null && teamB !== null && priority
					? [
							{
								id,
								teams: [teamA, teamB],
								round,
								bestOf,
								priority: priority.team,
							},
						]
					: [],
		);
	} else if (play.type === "swiss") {
		fixtures =
			previous?.fixtures.filter(
				({ id, tiebreaker }) => !tiebreaker && !registered.has(id),
			) ?? [];
		if (!fixtures.length)
			({ fixtures, paired } = swissFixtures(
				node,
				entrants,
				played,
				seed,
				year,
			));
	} else if (play.type === "roundRobin" || play.type === "groups") {
		const result = stageFixtures(graph, node, outcomes, seed, year);
		for (const f of result.fixtures ?? []) {
			if (registered.has(f.id)) continue;
			const [a, b] = f.teams;
			if (a === null || b === null) continue;
			const [, round, index] = f.id.split("-");
			fixtures.push({
				id: f.id,
				teams: [a, b],
				round: Number(round),
				bestOf:
					f.bestOf ??
					(play.type === "roundRobin" ? play.bestOf : play.inner.bestOf),
				priority: priorityFor([a, b], Number(round), Number(index) - 1),
				groupPoints: f.groupPoints,
			});
		}
	}
	const final = bracket ? bracket.champion !== null : fixtures.length === 0;
	const tables = stageTables(
		graph,
		node,
		outcomes,
		entrants,
		resolved.groups,
		played,
		seed,
		year,
		final,
		bracket,
	);
	const ties = [...(previous?.ties ?? [])];
	if (tables.pending.length) {
		const drawRound = 0xfffffffc;
		const round =
			1 +
			played.reduce(
				(last, { fixture }) =>
					fixture.tiebreaker ? last : max(last, fixture.round),
				0,
			);
		const rng = createRng(
			deriveSeed(
				seed,
				SCOPES.schedule,
				scope.competition,
				year,
				scope.stage,
				drawRound,
			),
		);
		const order = shuffle(rng, tables.pending);
		const after = calendar.series
			.map(({ id }) => localFixtureId(id))
			.filter((id) => !id.startsWith("tie-") && registered.has(id));
		for (const { a, b } of order) {
			let index = ties.findIndex(
				({ teams }) => teams.includes(a) && teams.includes(b),
			);
			if (index < 0) {
				index = ties.length;
				ties.push({
					id: `tie-${index}`,
					teams: [a, b],
					entrants: [a, b],
					after,
					bestOf: tiebreakerBestOf,
				});
			}
			fixtures.push({
				id: `tie-${index}`,
				teams: [a, b],
				round,
				bestOf: tiebreakerBestOf,
				priority: priorityFor([a, b], drawRound, index),
				tiebreaker: true,
			});
		}
	}
	return {
		progress: {
			...tables,
			played,
			fixtures,
			ties,
			done: final && !tables.pending.length,
		},
		...(paired && { paired }),
	};
}

export const localFixtureId = (id: string): string =>
	(JSON.parse(id) as [string, string, string])[2];

export function isUnusedReservation(
	stage: StageProgress | undefined,
	id: string,
) {
	if (!stage) return false;
	if (stage.done) return !stage.played.some(({ fixture }) => fixture.id === id);
	if (
		stage.bracket?.matches.some(
			(match) => match.id === id && match.status === "skipped",
		)
	)
		return true;
	const swiss = stage.fixtures.find((fixture) =>
		fixture.id.startsWith("swiss-"),
	);
	if (!id.startsWith("swiss-")) return false;
	if (!swiss && stage.ties.length === 0) return false;
	return (
		(!swiss || Number(id.split("-")[1]) <= swiss.round) &&
		!stage.fixtures.some((fixture) => fixture.id === id) &&
		!stage.played.some(({ fixture }) => fixture.id === id)
	);
}

export const isStageReady = (
	graph: StageGraph,
	node: StageNode,
	outcomes: StageOutcomes,
) =>
	[...(graph.dependencies.get(stageKey(node.ref)) ?? [])].every((key) =>
		outcomes.has(key),
	);
