import type { AiContent } from "@rift-legends/contracts";
import { SCALE } from "../../math";
import type { Champion } from "../content-index";

type Plan = AiContent["identities"][number];

const strengths = new WeakMap<Plan, WeakMap<Champion, number>>();
const matches = (plan: Plan, c: Champion) => {
	let byChampion = strengths.get(plan);
	if (!byChampion) {
		byChampion = new WeakMap();
		strengths.set(plan, byChampion);
	}
	let known = byChampion.get(c);
	if (known === undefined) {
		known = c.archetypes.filter((a) => plan.archetypes.includes(a)).length;
		byChampion.set(c, known);
	}
	return known;
};

/** Scores candidates against fixed allies: only plans the allies already reach count. */
export function identityFor(
	plans: AiContent["identities"],
	allies: readonly Champion[],
) {
	const reached =
		allies.length < 2
			? []
			: plans.filter(
					(plan) =>
						allies.reduce((count, c) => count + matches(plan, c), 0) >=
						plan.threshold,
				);
	return (candidate: Champion) => {
		let best = 0;
		for (const plan of reached) {
			const strength = matches(plan, candidate);
			if (strength > best) best = strength;
		}
		return best * 2 * SCALE;
	};
}
