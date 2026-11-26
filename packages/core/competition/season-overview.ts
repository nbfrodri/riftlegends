import type { RunningSeason } from "./handlers";
import { projectSchedule } from "./season-views";
import { stageKey } from "./stage-model";

type Status = "pending" | "live" | "finished";

/** The `season.overview` query (plan 31, Q1). */
export function seasonOverview(season: RunningSeason | undefined) {
	if (!season) return { year: 0, day: null, competitions: [] };
	const windows = new Map(
		season.calendar.map(({ ref, startDay, endDay }) => [
			stageKey(ref),
			{ startDay, endDay },
		]),
	);
	const next = projectSchedule(season).find(
		({ status }) => status !== "played",
	);
	const competitions = season.formats.map(({ id }) => {
		const nodes = [...season.graph.nodes.entries()]
			.filter(([, node]) => node.ref.competition === id)
			.sort(([, a], [, b]) => a.stageIndex - b.stageIndex);
		const stages = nodes.map(([key, node]) => {
			const progress = season.stages.get(key);
			const status: Status = progress?.done
				? "finished"
				: progress?.played.length
					? "live"
					: "pending";
			return {
				stage: node.ref.stage,
				play: node.stage.play.type,
				status,
				...(windows.get(key) ?? { startDay: 0, endDay: 0 }),
			};
		});
		const statuses = new Set(stages.map(({ status }) => status));
		const status: Status =
			statuses.size === 1 && statuses.has("finished")
				? "finished"
				: statuses.size === 1 && statuses.has("pending")
					? "pending"
					: "live";
		const [lastKey, lastNode] = nodes.at(-1) ?? [];
		const lastProgress = lastKey ? season.stages.get(lastKey) : undefined;
		const liveKey = nodes.find(([key]) => {
			const progress = season.stages.get(key);
			return progress && !progress.done && progress.played.length;
		})?.[0];
		const top = liveKey ? season.stages.get(liveKey) : undefined;
		const leader = !season.graph.nodes.get(liveKey ?? "")?.bracket
			? top?.standings.rows[0]
			: undefined;
		const champion =
			status === "finished" && lastNode
				? (lastProgress?.bracket?.champion ??
					lastProgress?.standings.rows[0]?.team)
				: undefined;
		return {
			id,
			status,
			...(leader && {
				leader: {
					team: leader.team,
					seriesWins: leader.seriesWins,
					seriesLosses: leader.seriesLosses,
				},
			}),
			...(champion && { champion }),
			stages,
		};
	});
	return { year: season.year, day: next?.day ?? null, competitions };
}
