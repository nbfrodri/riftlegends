import { DRAFT_ORDER, phaseAt } from "../../draft/order";
import { max } from "../../math";
import type { AiContext } from "../context";

export function side(
	ctx: AiContext,
	flexPoints: number,
	matchupPoints: number,
) {
	const turn = DRAFT_ORDER[ctx.step];
	if (turn?.side !== ctx.side || turn.action !== "pick") return 0;
	if (ctx.side === "blue" && phaseAt(ctx.step) === "picks1") return flexPoints;
	if (ctx.side === "red" && ctx.step === DRAFT_ORDER.length - 1)
		return max(0, matchupPoints);
	return 0;
}
