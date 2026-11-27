import type { AiContent } from "@rift-legends/contracts";
import { SCALE } from "../../math";

type Player = AiContent["players"][number];

const known = new WeakMap<Player, Map<string, number>>();

/** Points per champion of a player, in the order the pools are read: mains, secondary, weak. */
function pointsOf(player: Player) {
	const points = new Map<string, number>();
	for (const id of player.weak) points.set(id, -4 * SCALE);
	for (const id of player.secondary) points.set(id, 2 * SCALE);
	for (const id of player.mains) points.set(id, 4 * SCALE);
	return points;
}

export function comfort(player: Player | undefined, id: string): number {
	if (!player) return 0;
	let points = known.get(player);
	if (!points) {
		points = pointsOf(player);
		known.set(player, points);
	}
	return points.get(id) ?? 0;
}
