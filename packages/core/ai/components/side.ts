import { ROLES, type Role } from "@rift-legends/contracts";
import { DRAFT_ORDER, phaseAt } from "../../draft/order";
import { max, SCALE } from "../../math";
import type { Champion } from "../content-index";
import type { AiContext } from "../context";
import { canAssign } from "../positions";
import { meta } from "./meta";

const LAST_STEP = DRAFT_ORDER.length - 1;
/** Tier points above A: what securing an S or S+ champion is worth to the first pick. */
const SECURED_FROM = meta("A");
/** What the last pick loses by filling the lane it could still counter at the end. */
export const KEEP_COUNTER = 2 * SCALE;

/**
 * What the pick order asks of this pick (issue #364). The first pick secures
 * strong or flexible champions in the first pick phase; the last pick keeps a
 * lane whose opponent is still hidden and counters it with its final pick.
 */
export type OrderPlan = "secure" | "keep" | "counter" | "none";

export function orderPlan(ctx: Pick<AiContext, "order" | "step">): OrderPlan {
	const turn = DRAFT_ORDER[ctx.step];
	if (turn?.order !== ctx.order || turn.action !== "pick") return "none";
	if (ctx.order === "first")
		return phaseAt(ctx.step) === "picks1" ? "secure" : "none";
	return ctx.step === LAST_STEP ? "counter" : "keep";
}

/** The first pick's points: roster-backed flex plus the tier above A of its lane. */
export const securePoints = (flexPoints: number, laneMeta: number) =>
	flexPoints + max(0, laneMeta - SECURED_FROM);

/** The last pick's final counter: only a winning matchup counts. */
export const counterPoints = (matchupPoints: number) => max(0, matchupPoints);

/**
 * For each lane the team can fill now, the lanes it can still leave open
 * after it, with every allied pick in a distinct lane. Ignores the rival.
 */
export function keepableLanes(allies: readonly Champion[]) {
	const keepable = new Map<Role, Role[]>();
	for (const filled of ROLES) {
		if (!canAssign(allies, filled)) continue;
		keepable.set(
			filled,
			ROLES.filter(
				(open) =>
					open !== filled &&
					canAssign(allies, filled, (used) => !used.has(open)),
			),
		);
	}
	return keepable;
}

/**
 * The cost of filling each lane for the last pick before its final pick: it
 * pays `KEEP_COUNTER` when it fills the last lane whose opponent the rival
 * can still hide, while another lane would have kept one open.
 */
export function keepCost(
	keepable: ReadonlyMap<Role, readonly Role[]>,
	rivals: readonly Champion[],
): (role: Role) => number {
	const hidden = new Set(ROLES.filter((role) => canAssign(rivals, role)));
	const keeps = (role: Role) =>
		keepable.get(role)?.some((open) => hidden.has(open)) ?? false;
	const canKeep = [...keepable.keys()].some(keeps);
	return (role) => (canKeep && !keeps(role) ? -KEEP_COUNTER : 0);
}
