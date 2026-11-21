import type { Side } from "@rift-legends/contracts";

export type DraftAction = "ban" | "pick";

export interface DraftStep {
	readonly side: Side;
	readonly action: DraftAction;
}

const steps = (action: DraftAction, sides: string): DraftStep[] =>
	sides.split(" ").map((s) => ({ side: s === "B" ? "blue" : "red", action }));

/** The professional draft: 20 actions in four phases (plan 06). */
export const DRAFT_ORDER: readonly DraftStep[] = [
	...steps("ban", "B R B R B R"),
	...steps("pick", "B R R B B R"),
	...steps("ban", "R B R B"),
	...steps("pick", "R B B R"),
];
