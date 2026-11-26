import { type Emitted, QueryRejection } from "../server/dispatcher";
import type { RunningSeason, ScheduleQuery, SeasonSession } from "./handlers";
import { awardPlaces } from "./qualification";
import { isUnusedReservation, localFixtureId } from "./season-stages";
import { type StageRef, stageKey } from "./stage-model";

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
	if (kind === "bracket") return stage.bracket ?? null;
	return { ...stage.standings, ...(stage.groups && { groups: stage.groups }) };
}
