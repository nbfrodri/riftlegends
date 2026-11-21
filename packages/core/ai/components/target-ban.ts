import type { Role } from "@rift-legends/contracts";
import { max } from "../../math";
import type { Roster } from "../content-index";
import { comfort } from "./comfort";

export function targetBan(
	knowsRivalPools: boolean,
	roster: Roster | undefined,
	positions: readonly Role[],
	id: string,
) {
	if (!knowsRivalPools || !roster) return 0;
	let best: number | undefined;
	for (const role of positions) {
		const player = roster.get(role);
		if (!player) continue;
		// Comfort is a whole number of points in fixed point. Division by 100 is exact.
		const value = (comfort(player, id) / 100) * player.level;
		best = best === undefined ? value : max(best, value);
	}
	return best ?? 0;
}
