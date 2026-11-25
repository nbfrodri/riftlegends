import {
	type Competition,
	type CoreError,
	validateFormat,
} from "@rift-legends/contracts";
import { type Bracket, buildDoubleElim, buildSingleElim } from "./bracket";
import {
	type AwardRule,
	drawPots,
	type IncomingPlace,
	type SeasonTeam,
	type Stage,
	type StageGraph,
	type StageNode,
	type StageRef,
	selectedPlaces,
	sourceRef,
	sourcesOf,
	stageError,
	stageKey,
} from "./stage-model";

const bracketFor = ({ play }: Stage): Bracket | undefined => {
	if (play.type === "singleElim") return buildSingleElim(play);
	if (play.type === "doubleElim") return buildDoubleElim(play);
};

const invalidFormat = (path: string): CoreError => ({
	code: "invalid-format",
	params: { path },
});

function awardRules(
	competitions: readonly Competition[],
	nodes: ReadonlyMap<string, StageNode>,
) {
	const awards = new Map<string, Map<string, AwardRule[]>>();
	const incoming = new Map<string, IncomingPlace[]>();
	for (const competition of competitions) {
		for (const slot of competition.slots ?? []) {
			const target = competitions.find((c) => c.id === slot.to);
			if (competition.kind !== "league" || target?.kind !== "international") {
				return {
					error: {
						code: "slots-mismatch",
						params: { competition: slot.to, actual: slot.count, expected: 0 },
					} as CoreError,
				};
			}
			const stage = {
				competition: competition.id,
				stage: slot.stage ?? (competition.stages.at(-1)?.id as string),
			};
			const origin = nodes.get(stageKey(stage));
			if (!origin)
				return {
					error: {
						code: "invalid-stage-ref",
						params: { ...stage },
					} as CoreError,
				};

			const byLeague = awards.get(slot.to) ?? new Map<string, AwardRule[]>();
			const rules = byLeague.get(competition.id) ?? [];
			const firstPlace = 1 + rules.reduce((n, rule) => n + rule.slot.count, 0);
			rules.push({ slot, stage, firstPlace });
			byLeague.set(competition.id, rules);
			awards.set(slot.to, byLeague);
			const places = incoming.get(slot.to) ?? [];
			for (let offset = 0; offset < slot.count; offset++) {
				places.push({ league: competition.id, place: firstPlace + offset });
			}
			incoming.set(slot.to, places);
		}
	}
	// Stable tie order is the season's competition order, like the RNG indexes.
	for (const places of incoming.values())
		places.sort((a, b) => a.place - b.place);
	return { awards, incoming };
}

interface Edges {
	readonly keys: Set<string>;
	readonly ownPlaces: Set<IncomingPlace>;
}

function collectEdges(
	graph: StageGraph,
	node: StageNode,
	edges: Edges,
): CoreError | undefined {
	const { stage } = node;
	const seen = new Set<string>();
	const note = (id: string) => {
		const repeated = seen.has(id);
		seen.add(id);
		return repeated;
	};
	const add = (ref: StageRef) => {
		const key = stageKey(ref);
		const origin = graph.nodes.get(key);
		if (
			!origin ||
			(ref.competition === node.ref.competition &&
				origin.stageIndex >= node.stageIndex)
		)
			return undefined;
		edges.keys.add(key);
		return origin;
	};
	let size = 0;
	let qualification = false;
	for (const stage of node.stage.tiebreakHistory ?? []) {
		if (!add({ competition: node.ref.competition, stage }))
			return stageError(node, "invalid-stage-ref", { stage });
	}
	for (const source of sourcesOf(stage)) {
		if (source.kind === "fixed") {
			for (const id of source.teams) {
				if (!graph.teams.has(id) || note(JSON.stringify(["team", id])))
					return stageError(node, "invalid-format", { path: "entrants" });
				size++;
			}
		} else if (source.kind === "standing" || source.kind === "bracket") {
			const ref = sourceRef(source, node);
			const origin = add(ref);
			if (!origin) return stageError(node, "invalid-stage-ref");
			if (source.kind === "standing") {
				const play = origin.stage.play;
				if (
					source.group &&
					(play.type !== "groups" ||
						play.seeding !== "cross" ||
						play.count !== 2 ||
						play.size % 2 !== 0)
				)
					return stageError(node, "invalid-format", { path: "entrants" });
				const available = source.group ? play.size / 2 : play.size;
				if (source.to > available) {
					return stageError(node, "not-enough-teams", {
						needed: source.to,
						available,
					});
				}
				for (let rank = source.from; rank <= source.to; rank++) {
					if (note(JSON.stringify([ref, source.group, rank])))
						return stageError(node, "invalid-format", { path: "entrants" });
					size++;
				}
			} else {
				const match = origin.bracket?.matches.find(
					(m) => m.id === source.match,
				);
				if (!match)
					return stageError(node, "invalid-stage-ref", { match: source.match });
				if (note(JSON.stringify([ref, source.match, source.result])))
					return stageError(node, "invalid-format", { path: "entrants" });
				size++;
			}
		} else {
			qualification = true;
			const places = selectedPlaces(graph, node, source);
			if (!places) return stageError(node, "slots-mismatch");
			for (const place of places) {
				if (edges.ownPlaces.has(place))
					return stageError(node, "slots-mismatch");
				edges.ownPlaces.add(place);
				size++;
				for (const rule of graph.awards
					.get(node.ref.competition)
					?.get(place.league) ?? []) {
					if (rule.firstPlace <= place.place && !add(rule.stage))
						return stageError(node, "invalid-stage-ref");
				}
			}
		}
	}
	if (qualification && size !== stage.play.size)
		return stageError(node, "slots-mismatch", {
			actual: size,
			expected: stage.play.size,
		});
	if (size < stage.play.size)
		return stageError(node, "not-enough-teams", {
			needed: stage.play.size,
			available: size,
		});
	if (size > stage.play.size)
		return stageError(node, "invalid-format", { path: "entrants" });

	const pots = drawPots(node);
	const play = stage.play;
	if (play.type === "swiss" && size % 2 !== 0) {
		return stageError(node, "invalid-format", { path: "play.size" });
	}
	if (
		pots !== undefined &&
		(pots > size ||
			(play.type === "groups" && play.seeding === "ranked") ||
			(play.type === "swiss" && pots !== (size % 4 === 0 ? 4 : 2)))
	)
		return stageError(node, "invalid-format", { path: "draw" });
	return undefined;
}

function validateEdges(
	graph: StageGraph,
	deps: Map<string, ReadonlySet<string>>,
): CoreError | undefined {
	const covered = new Set<IncomingPlace>();
	for (const [key, node] of graph.nodes) {
		const edges: Edges = { keys: new Set(), ownPlaces: new Set() };
		const error = collectEdges(graph, node, edges);
		if (error) return error;
		for (const place of edges.ownPlaces) {
			if (covered.has(place)) return stageError(node, "slots-mismatch");
			covered.add(place);
		}
		deps.set(key, edges.keys);
	}
	for (const [competition, places] of graph.incoming) {
		const expected = places.filter((place) => covered.has(place)).length;
		if (expected !== places.length)
			return {
				code: "slots-mismatch",
				params: { competition, actual: places.length, expected },
			};
	}
	const completed = new Set<string>();
	const active = new Set<string>();
	const cycle = (key: string): boolean => {
		if (active.has(key)) return true;
		if (completed.has(key)) return false;
		active.add(key);
		if ([...(deps.get(key) ?? [])].some(cycle)) return true;
		active.delete(key);
		completed.add(key);
		return false;
	};
	for (const [key, node] of graph.nodes) {
		if (cycle(key)) return stageError(node, "invalid-stage-ref");
	}
}

export function buildStageGraph(
	formats: readonly unknown[],
	teams: readonly SeasonTeam[],
): { ok: true; graph: StageGraph } | { ok: false; error: CoreError } {
	const competitions: Competition[] = [];
	const nodes = new Map<string, StageNode>();
	const teamById = new Map(teams.map((team) => [team.id, { ...team }]));
	if (teamById.size !== teams.length)
		return { ok: false, error: invalidFormat("teams") };
	for (const [competitionIndex, raw] of formats.entries()) {
		const result = validateFormat(raw);
		if (!result.ok) return result;
		const competition = result.competition;
		if (competitions.some((c) => c.id === competition.id)) {
			return {
				ok: false,
				error: invalidFormat(`competitions.${competitionIndex}.id`),
			};
		}
		competitions.push(competition);
		for (const [stageIndex, stage] of competition.stages.entries()) {
			const ref = { competition: competition.id, stage: stage.id };
			try {
				nodes.set(stageKey(ref), {
					ref,
					stage,
					stageIndex,
					competitionIndex,
					tiebreak: competition.tiebreak,
					bracket: bracketFor(stage),
				});
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				return {
					ok: false,
					error: invalidFormat(
						`competitions.${competitionIndex}.stages.${stageIndex}.play`,
					),
				};
			}
		}
	}
	const allocations = awardRules(competitions, nodes);
	if (allocations.error) return { ok: false, error: allocations.error };
	const leagues = new Set(
		competitions.filter((c) => c.kind === "league").map((c) => c.id),
	);
	const dependencies = new Map<string, ReadonlySet<string>>();
	const graph: StageGraph = {
		...allocations,
		nodes,
		dependencies,
		teams: teamById,
		leagues,
	};
	const error = validateEdges(graph, dependencies);
	return error ? { ok: false, error } : { ok: true, graph };
}
