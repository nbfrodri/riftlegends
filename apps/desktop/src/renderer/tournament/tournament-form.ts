import type {
	CoreError,
	CustomStage,
	TOURNAMENT_PRESETS,
} from "@rift-legends/contracts";

// The state of the tournament setup (U9) and how a core error finds its field.

export type Preset = (typeof TOURNAMENT_PRESETS)[number];
export type Mode = Preset | "custom";
export type BestOf = 1 | 3 | 5;
export type Block = CustomStage["type"];
export type Playoffs = "none" | "singleElim" | "doubleElim";

export interface CustomForm {
	readonly block: Block;
	readonly bestOf: BestOf;
	readonly groups: number;
	readonly playoffs: Playoffs;
	readonly playoffSize: number;
	readonly playoffBestOf: BestOf;
}

export const DEFAULT_CUSTOM: CustomForm = {
	block: "roundRobin",
	bestOf: 1,
	groups: 2,
	playoffs: "none",
	playoffSize: 4,
	playoffBestOf: 3,
};

/** Teams a new custom tournament starts with: the best seeds. */
export const CUSTOM_TEAMS = 8;

export const isKnockout = (block: Block) =>
	block === "singleElim" || block === "doubleElim";

/** The editor's stages as `tournament.create` takes them. */
export function customStages(form: CustomForm): CustomStage[] {
	const first: CustomStage = {
		type: form.block,
		bestOf: form.bestOf,
		...(form.block === "groups" && { groups: form.groups }),
	};
	if (form.playoffs === "none" || isKnockout(form.block)) return [first];
	return [
		first,
		{ type: form.playoffs, size: form.playoffSize, bestOf: form.playoffBestOf },
	];
}

/** Stage ids the core gives a custom tournament, to place its errors. */
export function customStageIds(form: CustomForm): string[] {
	const ids: Record<Block, string> = {
		roundRobin: "league",
		groups: "groups",
		swiss: "swiss",
		singleElim: "bracket",
		doubleElim: "bracket",
	};
	return customStages(form).map((_, index) =>
		index === 0 ? ids[form.block] : "playoffs",
	);
}

export type Field =
	| { kind: "general" }
	| { kind: "teams" }
	| { kind: "team"; index: number }
	| { kind: "humanTeam" }
	| { kind: "stage"; index: number };

/** The field a core error belongs to; `stageIds` are the custom stages, if any. */
export function fieldOf(error: CoreError, stageIds: readonly string[]): Field {
	const path = typeof error.params.path === "string" ? error.params.path : "";
	const team = /^teams\.(\d+)$/.exec(path);
	if (team) return { kind: "team", index: Number(team[1]) };
	if (path === "teams") return { kind: "teams" };
	if (path === "humanTeam") return { kind: "humanTeam" };
	const stage = /^stages\.(\d+)/.exec(path);
	if (stage && stageIds.length)
		return { kind: "stage", index: Number(stage[1]) };
	const index =
		typeof error.params.stage === "string"
			? stageIds.indexOf(error.params.stage)
			: -1;
	return index >= 0 ? { kind: "stage", index } : { kind: "general" };
}

export const sameField = (a: Field, b: Field) =>
	JSON.stringify(a) === JSON.stringify(b);
