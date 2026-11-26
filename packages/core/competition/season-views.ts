import { type Emitted, QueryRejection } from "../server/dispatcher";
import type { RunningSeason, ScheduleQuery, SeasonSession } from "./handlers";
import { awardPlaces } from "./qualification";
import { isUnusedReservation, localFixtureId } from "./season-stages";
import {
	type StageGraph,
	type StageRef,
	sourceRef,
	sourcesOf,
	stageKey,
} from "./stage-model";

export function projectSchedule(
	season: RunningSeason,
	params: ScheduleQuery = {},
) {
	return season.calendar
		.flatMap(({ ref, series }) => {
			if (
				params.competition !== undefined &&
				ref.competition !== params.competition
			)
				return [];
			const stage = season.stages.get(stageKey(ref));
			const completed = new Map(
				stage?.played.map((result) => [result.fixture.id, result]),
			);
			const upcoming = new Map(
				stage?.fixtures.map((fixture) => [fixture.id, fixture]),
			);
			return series.flatMap((slot) => {
				if (
					slot.day < (params.fromDay ?? 0) ||
					slot.day > (params.toDay ?? Infinity)
				)
					return [];
				const id = localFixtureId(slot.id);
				if (isUnusedReservation(stage, id)) return [];
				const played = completed.get(id);
				const ready = upcoming.get(id);
				const fixture = played?.fixture ?? ready;
				if (
					params.team !== undefined &&
					!(fixture?.teams ?? slot.teams).includes(params.team)
				)
					return [];
				return [
					{
						...slot,
						...ref,
						...(fixture && {
							teams: fixture.teams,
							bestOf: fixture.bestOf,
							round: fixture.round,
							priority: fixture.priority,
							tiebreaker: fixture.tiebreaker ?? false,
						}),
						...(played && {
							winner: played.winner,
							score: [played.result.winsA, played.result.winsB],
						}),
						status: played
							? ("played" as const)
							: ready
								? ("ready" as const)
								: ("pending" as const),
					},
				];
			});
		})
		.sort((a, b) => a.day - b.day);
}

export function recordQualifications(season: RunningSeason, facts: Emitted[]) {
	const qualifications = new Map(season.qualifications);
	for (const [to, places] of season.graph.incoming) {
		for (const { league: from, place } of places) {
			const key = JSON.stringify([to, from, place]);
			if (qualifications.has(key)) continue;
			const awards = awardPlaces(
				season.graph,
				to,
				from,
				place,
				season.outcomes,
			);
			const entry = "places" in awards ? awards.places.get(place) : undefined;
			if (!entry) continue;
			const fact = {
				type: "competition.qualified",
				from,
				to,
				team: entry.team,
				rule: entry.source.rule,
				via: entry.source.via,
			};
			qualifications.set(key, fact);
			facts.push(fact);
		}
	}
	return qualifications;
}

export function stageView(
	state: SeasonSession,
	ref: StageRef,
	kind: "standings" | "bracket",
) {
	const key = stageKey(ref);
	if (!state.season?.graph.nodes.has(key))
		return new QueryRejection({
			code: "invalid-stage-ref",
			params: { ...ref },
		});
	const stage = state.season.stages.get(key);
	if (!stage) return null;
	if (kind === "bracket") {
		const source = state.season.graph.nodes.get(key)?.bracket;
		const records = new Map(
			[...state.season.records.values()]
				.filter(
					(r) => r.competition === ref.competition && r.stage === ref.stage,
				)
				.map((r) => [localFixtureId(r.id), r]),
		);
		return stage.bracket && source
			? {
					...stage.bracket,
					matches: stage.bracket.matches.map((match, index) => {
						const record = records.get(match.id);
						const [a, b] = record?.score ?? [0, 0];
						return {
							...match,
							// Where each team comes from: a seed, or the winner or loser of a match.
							from: [source.matches[index]?.a, source.matches[index]?.b],
							...(record && {
								series: record.id,
								score: record.teams[0] === match.teamA ? [a, b] : [b, a],
							}),
						};
					}),
				}
			: null;
	}
	return {
		...stage.standings,
		...(stage.groups && { groups: stage.groups }),
		destinations: stageDestinations(state.season.graph, ref),
	};
}

/**
 * Where the places of a stage lead, read from the formats: the later stages
 * that take teams by their place, then the international slots that read the
 * stage. A season-points slot reads no single table and is left out.
 */
function stageDestinations(graph: StageGraph, ref: StageRef) {
	const key = stageKey(ref);
	const stages = [...graph.nodes.values()].flatMap((next) =>
		sourcesOf(next.stage).flatMap((source) =>
			source.kind === "standing" && stageKey(sourceRef(source, next)) === key
				? [
						{
							from: source.from,
							to: source.to,
							...next.ref,
							...(source.group && { group: source.group }),
						},
					]
				: [],
		),
	);
	const events = [...graph.awards].flatMap(([to, leagues]) =>
		(leagues.get(ref.competition) ?? []).flatMap(({ slot, stage }) =>
			slot.rule !== "points" && stage.stage === ref.stage
				? [{ from: 1, to: slot.count, competition: to }]
				: [],
		),
	);
	return [...stages, ...events];
}
