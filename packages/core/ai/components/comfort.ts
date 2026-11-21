import type { AiContent } from "@rift-legends/contracts";
import { SCALE } from "../../math";

export function comfort(
	player: AiContent["players"][number] | undefined,
	id: string,
): number {
	if (player?.mains.includes(id)) return 4 * SCALE;
	if (player?.secondary.includes(id)) return 2 * SCALE;
	if (player?.weak.includes(id)) return -4 * SCALE;
	return 0;
}
