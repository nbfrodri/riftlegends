import { SCALE } from "../../math";
import type { Champion } from "../content-index";

function coverage(
	champion: Champion,
	job: "tank" | "engage" | "carry" | "peel",
) {
	return (
		champion.archetypes.includes(job) ||
		(job === "carry" && champion.archetypes.includes("hypercarry"))
	);
}

function supplies(champion: Champion, type: "physical" | "magic") {
	return champion.damage === type || champion.damage === "mixed";
}

export function composition(candidate: Champion, allies: readonly Champion[]) {
	let units = 0;
	for (const job of ["tank", "engage", "carry", "peel"] as const) {
		if (coverage(candidate, job) && !allies.some((ally) => coverage(ally, job)))
			units += 2;
	}
	for (const type of ["physical", "magic"] as const) {
		if (!supplies(candidate, type)) continue;
		const same = allies.filter((ally) => supplies(ally, type)).length;
		const opposite = type === "physical" ? "magic" : "physical";
		if (same === 0 && allies.some((ally) => supplies(ally, opposite)))
			units += 3;
		if (same >= 2 && candidate.damage === type) units -= 5;
	}
	return units * SCALE;
}
