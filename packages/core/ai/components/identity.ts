import type { AiContent } from "@rift-legends/contracts";
import { SCALE } from "../../math";
import type { Champion } from "../content-index";

export function identity(
	plans: AiContent["identities"],
	candidate: Champion,
	allies: readonly Champion[],
) {
	if (allies.length < 2) return 0;
	let best = 0;
	for (const plan of plans) {
		const matches = (c: Champion) =>
			c.archetypes.filter((a) => plan.archetypes.includes(a)).length;
		const strength = matches(candidate);
		if (strength <= best) continue;
		if (allies.reduce((count, c) => count + matches(c), 0) >= plan.threshold)
			best = strength;
	}
	return best * 2 * SCALE;
}
