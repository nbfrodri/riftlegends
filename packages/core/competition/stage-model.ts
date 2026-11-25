import type { Competition, CoreError } from "@rift-legends/contracts";
import type { Bracket } from "./bracket";

export type Stage = Competition["stages"][number];
type Source = Exclude<Stage["entrants"], unknown[]>;
type Award = NonNullable<Competition["slots"]>[number];

export interface StageRef {
	readonly competition: string;
	readonly stage: string;
}

export interface SeasonTeam {
	readonly id: string;
	readonly competition: string;
	readonly region: string;
	readonly rank: number;
}

export const stageKey = ({ competition, stage }: StageRef): string =>
	JSON.stringify([competition, stage]);

export interface StageNode {
	readonly ref: StageRef;
	readonly stage: Stage;
	readonly competitionIndex: number;
	readonly stageIndex: number;
	readonly bracket: Bracket | undefined;
}

export interface AwardRule {
	readonly slot: Award;
	readonly stage: StageRef;
	readonly firstPlace: number;
}

export interface IncomingPlace {
	readonly league: string;
	readonly place: number;
}

export interface StageGraph {
	readonly nodes: ReadonlyMap<string, StageNode>;
	readonly dependencies: ReadonlyMap<string, ReadonlySet<string>>;
	readonly teams: ReadonlyMap<string, SeasonTeam>;
	readonly leagues: ReadonlySet<string>;
	readonly awards: ReadonlyMap<
		string,
		ReadonlyMap<string, readonly AwardRule[]>
	>;
	readonly incoming: ReadonlyMap<string, readonly IncomingPlace[]>;
}

export const sourcesOf = (stage: Stage): Source[] =>
	Array.isArray(stage.entrants) ? stage.entrants : [stage.entrants];

export const sourceRef = (
	source: Extract<Source, { kind: "standing" | "bracket" }>,
	node: StageNode,
): StageRef => ({
	competition: source.competition ?? node.ref.competition,
	stage: source.stage,
});

export const stageError = (
	node: StageNode,
	code: CoreError["code"],
	params: CoreError["params"] = {},
): CoreError => ({
	code,
	params: {
		competition: node.ref.competition,
		stage: node.ref.stage,
		...params,
	},
});

export function selectedPlaces(
	graph: StageGraph,
	node: StageNode,
	source: Extract<Source, { kind: "qualified" | "pots" }>,
): readonly IncomingPlace[] | undefined {
	const field = graph.incoming.get(node.ref.competition) ?? [];
	if (source.kind === "pots") {
		const leagues = new Set(source.from);
		if (
			leagues.size !== source.from.length ||
			source.from.some((league) => !graph.leagues.has(league))
		)
			return undefined;
		return field.filter((p) => leagues.has(p.league));
	}
	if (source.competition !== node.ref.competition) return undefined;
	if (!source.places) return field;
	const selected = source.places.flatMap(({ league, place }) =>
		field.filter((entry) => entry.league === league && entry.place === place),
	);
	return selected.length === source.places.length ? selected : undefined;
}

export function drawPots(node: StageNode): number | undefined {
	const pots = sourcesOf(node.stage).find((s) => s.kind === "pots")?.pots;
	return node.stage.draw?.pots ?? pots;
}
