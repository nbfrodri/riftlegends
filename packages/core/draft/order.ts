export type DraftAction = "ban" | "pick";
/** First pick opens the draft; last pick closes it. Independent of map side (issue #305). */
export type Order = "first" | "last";

export interface DraftStep {
	readonly order: Order;
	readonly action: DraftAction;
}

const steps = (action: DraftAction, orders: string): DraftStep[] =>
	orders
		.split(" ")
		.map((o) => ({ order: o === "F" ? "first" : "last", action }));

/** The professional draft: 20 actions in four phases (plan 06). */
export const DRAFT_ORDER: readonly DraftStep[] = [
	...steps("ban", "F L F L F L"),
	...steps("pick", "F L L F F L"),
	...steps("ban", "L F L F"),
	...steps("pick", "L F F L"),
];

/** Phase of the step at `index`; past the last step, roles are assigned. */
export const phaseAt = (index: number) => {
	if (index < 6) return "bans1";
	if (index < 12) return "picks1";
	if (index < 16) return "bans2";
	if (index < 20) return "picks2";
	return "roles";
};
