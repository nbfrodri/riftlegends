import type { CoreError } from "@rift-legends/contracts";
import { max } from "../math/int";
import {
	awardPlaces,
	type Qualification,
	type StageOutcome,
	type StageOutcomes,
} from "./qualification";
import { seedGroups, seedStage } from "./stage-draw";
import {
	type IncomingPlace,
	type StageGraph,
	type StageNode,
	type StageRef,
	selectedPlaces,
	sourceRef,
	sourcesOf,
	stageError,
	stageKey,
} from "./stage-model";
import type { Explanation } from "./tiebreak";

export { buildStageGraph } from "./stage-graph";
export { stageKey } from "./stage-model";

type EntrantSource =
	| { kind: "fixed"; position: number }
	| {
			kind: "standing";
			stage: StageRef;
			rank: number;
			group?: "winner" | "loser";
			explanation: Explanation;
	  }
	| {
			kind: "bracket";
			stage: StageRef;
			match: string;
			result: "winner" | "loser";
	  }
	| Qualification;

interface Entry {
	readonly team: string;
	readonly source: EntrantSource;
}

interface StageSeed extends Entry {
	readonly league: string;
	readonly region: string;
	/** Position in the source list, before drawing any pots. */
	readonly initialSeed: number;
	readonly seed: number;
	readonly pot?: number;
	readonly group?: number | undefined;
}

type Resolution =
	| { status: "pending"; waitingFor: readonly StageRef[] }
	| { status: "error"; error: CoreError }
	| {
			status: "ready";
			entrants: readonly StageSeed[];
			groups: readonly (readonly string[])[] | undefined;
			relaxed: readonly "league"[];
	  };

type StageSource = ReturnType<typeof sourcesOf>[number];

function completedEntries(
	source: Extract<StageSource, { kind: "standing" | "bracket" }>,
	stage: StageRef,
	outcome: StageOutcome,
): Entry[] | undefined {
	if (source.kind === "standing") {
		const standings = source.group
			? outcome.groups?.[source.group]
			: outcome.standings;
		if (!standings || standings.pending.length) return undefined;
		return standings.rows
			.filter((row) => row.rank >= source.from && row.rank <= source.to)
			.sort((a, b) => a.rank - b.rank)
			.map(({ team, rank, explanation }) => ({
				team,
				source: {
					kind: "standing",
					stage,
					rank,
					explanation,
					...(source.group && { group: source.group }),
				},
			}));
	}
	const match = outcome.bracket?.matches.find(
		(match) => match.id === source.match,
	);
	if (match?.status === "skipped") return [];
	const team = match?.[source.result];
	return team == null
		? undefined
		: [
				{
					team,
					source: {
						kind: "bracket",
						stage,
						match: source.match,
						result: source.result,
					},
				},
			];
}

function qualifiedEntries(
	graph: StageGraph,
	node: StageNode,
	places: readonly IncomingPlace[],
	outcomes: StageOutcomes,
	waiting: Map<string, StageRef>,
): Entry[] {
	const byLeague = new Map<string, ReadonlyMap<number, Entry>>();
	const lastPlaceByLeague = new Map<string, number>();
	for (const { league, place } of places) {
		lastPlaceByLeague.set(
			league,
			max(lastPlaceByLeague.get(league) ?? 0, place),
		);
	}
	for (const [league, lastPlace] of lastPlaceByLeague) {
		const resolved = awardPlaces(
			graph,
			node.ref.competition,
			league,
			lastPlace,
			outcomes,
		);
		if ("places" in resolved) byLeague.set(league, resolved.places);
		else
			for (const stage of resolved.pending) waiting.set(stageKey(stage), stage);
	}
	return places.flatMap(({ league, place }) => {
		const entry = byLeague.get(league)?.get(place);
		return entry ? [entry] : [];
	});
}

/** Resolve the seed list from the supplied results without updating the season. */
export function resolveStage(
	graph: StageGraph,
	ref: StageRef,
	outcomes: StageOutcomes,
	rootSeed: number,
	season: number,
): Resolution {
	const node = graph.nodes.get(stageKey(ref));
	if (!node)
		return {
			status: "error",
			error: { code: "invalid-stage-ref", params: { ...ref } },
		};
	const waiting = new Map<string, StageRef>();
	const entries: Entry[] = [];
	for (const source of sourcesOf(node.stage)) {
		if (source.kind === "fixed") {
			entries.push(
				...source.teams.map((team, index) => ({
					team,
					source: { kind: "fixed" as const, position: index + 1 },
				})),
			);
		} else if (source.kind === "standing" || source.kind === "bracket") {
			const stage = sourceRef(source, node);
			const key = stageKey(stage);
			const outcome = outcomes.get(key);
			const resolved = outcome && completedEntries(source, stage, outcome);
			if (resolved) entries.push(...resolved);
			else waiting.set(key, stage);
		} else {
			const places = selectedPlaces(graph, node, source) ?? [];
			entries.push(...qualifiedEntries(graph, node, places, outcomes, waiting));
		}
	}
	if (waiting.size)
		return { status: "pending", waitingFor: [...waiting.values()] };

	if (
		new Set(entries.map((entry) => entry.team)).size !== entries.length ||
		entries.some((entry) => !graph.teams.has(entry.team))
	) {
		return {
			status: "error",
			error: stageError(node, "invalid-format", { path: "entrants" }),
		};
	}
	const needed = node.stage.play.size;
	if (entries.length !== needed) {
		return {
			status: "error",
			error: stageError(node, "not-enough-teams", {
				needed,
				available: entries.length,
			}),
		};
	}
	const ordered = entries.map((entry, index) => {
		const team = graph.teams.get(entry.team);
		if (!team) throw new RangeError(`Unknown team ${entry.team}`);
		return {
			...entry,
			initialSeed: index + 1,
			league: team.competition,
			region: team.region,
		};
	});
	const seeded = seedStage(node, ordered, rootSeed, season);
	const { groups, relaxed } = seedGroups(node, seeded);
	const groupOf = new Map(
		groups?.flatMap((teams, index) =>
			teams.map((team) => [team, index + 1] as const),
		),
	);
	return {
		status: "ready",
		entrants: seeded.map((entry) => ({
			...entry,
			group: groupOf.get(entry.team),
		})),
		groups,
		relaxed,
	};
}
