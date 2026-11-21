import type { DraftView } from "@rift-legends/contracts";
import type { ComponentType } from "react";
import { MatchScreen } from "../match/match-screen";
import { DraftBoard } from "./board/draft-board";
import { PlanScreen } from "./plan-screen";
import { ResultScreen } from "./result-screen";
import { RolesScreen } from "./roles-screen";
import type { Presentation } from "./session";
import { SetupScreen } from "./setup-screen";
import { SideScreen } from "./side-screen";

/** The sub-screens of the flow (plan 09): setup, side, draft, roles, plan, match and result. */
export type DraftStage =
	| "setup"
	| "side"
	| "draft"
	| "roles"
	| "plan"
	| "match"
	| "result";

/**
 * Which sub-screen shows: the presentation stage if there is one, otherwise
 * the one for the core's phase. `result` in the core means the draft is over
 * and the game has not been played yet: the plan screen's job until the user
 * plays, then the match screen's.
 */
export function stageOf(
	view: DraftView | null,
	presentation: Presentation | null,
): DraftStage {
	if (!view) return "setup";
	if (presentation) return presentation;
	switch (view.phase) {
		case "side":
			return "side";
		case "roles":
			return "roles";
		case "result":
			return "plan";
		case "over":
			return "result";
		default:
			return "draft";
	}
}

/**
 * The component for each stage in the quick-draft flow: each one reads the
 * flow with `useDraftSession()` and needs no props.
 */
export const draftStages: Record<DraftStage, ComponentType> = {
	setup: SetupScreen,
	side: SideScreen,
	draft: DraftBoard,
	roles: RolesScreen,
	plan: PlanScreen,
	match: MatchScreen,
	result: ResultScreen,
};
