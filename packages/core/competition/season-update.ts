import type { Emitted } from "../server/dispatcher";
import type { RunningSeason } from "./handlers";
import { advanceStage, isStageReady } from "./season-stages";
import type { Played } from "./season-tables";
import { recordQualifications } from "./season-views";
import { stageKey } from "./stage-model";

/** Advances every stage that the day's results unlock, until none moves. */
export function updateStages(
	season: RunningSeason,
	today: ReadonlyMap<string, readonly Played[]>,
	facts: Emitted[],
) {
	const stages = new Map(season.stages);
	const outcomes = new Map(season.outcomes);
	const updated = new Set<string>();
	const calendar = new Map(
		season.calendar.map((stage) => [stageKey(stage.ref), stage]),
	);
	for (;;) {
		let advanced = false;
		for (const [key, node] of season.graph.nodes) {
			const previous = stages.get(key);
			if (
				updated.has(key) ||
				previous?.done ||
				(previous && !today.has(key)) ||
				!isStageReady(season.graph, node, outcomes)
			)
				continue;
			const window = calendar.get(key);
			const format = season.formats[node.competitionIndex];
			if (!window || !format)
				throw new Error(`Missing stage format for ${key}`);
			const played = [...(previous?.played ?? []), ...(today.get(key) ?? [])];
			const next = advanceStage(
				season.graph,
				node,
				outcomes,
				window,
				previous,
				played,
				season.seed,
				season.year,
				format.tiebreakerBestOf,
			);
			if (next.error) return { ok: false as const, error: next.error };
			if (!next.progress) continue;
			advanced = true;
			updated.add(key);
			stages.set(key, next.progress);
			if (next.drawn) facts.push(next.drawn);
			if (next.paired) facts.push(next.paired);
			if (!next.progress.done) continue;
			outcomes.set(key, next.progress);
			facts.push({
				type: "competition.stageFinished",
				...node.ref,
				standings: next.progress.standings.rows,
			});
		}
		if (!advanced) break;
	}
	const next = { ...season, stages, outcomes };
	return {
		ok: true as const,
		season: { ...next, qualifications: recordQualifications(next, facts) },
	};
}
