import { phaseAt } from "../../draft/order";
import { SCALE } from "../../math";
import type { Champion } from "../content-index";

export function threatBan(
	candidate: Champion,
	allies: readonly Champion[],
	step: number,
) {
	if (allies.length === 0) return 0;
	const own = new Set(allies.flatMap((c) => c.archetypes));
	const threats = candidate.archetypes;
	let units = 0;
	if (
		threats.includes("dive") &&
		(own.has("carry") || own.has("hypercarry")) &&
		!own.has("peel")
	)
		units += 3;
	if (threats.includes("engage") && (own.has("poke") || own.has("splitpush")))
		units += 2;
	if (threats.includes("hypercarry") && !own.has("tank")) units += 2;
	return units * SCALE * (phaseAt(step) === "bans2" ? 2 : 1);
}
