import { SCALE } from "../../math";
import type { Champion } from "../content-index";
import type { AiContext } from "../context";

export function fearlessReserve(ctx: AiContext, candidate: Champion) {
	if (
		ctx.fearless === "off" ||
		ctx.wins.some((wins) => wins + 1 >= ctx.winsNeeded)
	)
		return 0;
	if (!candidate.positions.some((p) => p.tier === "S" || p.tier === "S+"))
		return 0;
	const remainingGames = 2 * ctx.winsNeeded - 1 - ctx.game;
	return -remainingGames * SCALE;
}
