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

const JOBS = ["tank", "engage", "carry", "peel"] as const;

interface Traits {
	readonly jobs: readonly boolean[];
	/** Supplies [physical, magic] damage. */
	readonly supply: readonly [boolean, boolean];
}

const traitsOf = new WeakMap<Champion, Traits>();
function traits(champion: Champion): Traits {
	let known = traitsOf.get(champion);
	if (!known) {
		known = {
			jobs: JOBS.map((job) => coverage(champion, job)),
			supply: [supplies(champion, "physical"), supplies(champion, "magic")],
		};
		traitsOf.set(champion, known);
	}
	return known;
}

/** Scores candidates against fixed allies; the allies are inspected once. */
export function compositionFor(allies: readonly Champion[]) {
	const known = allies.map(traits);
	const covered = JOBS.map((_, i) => known.some((t) => t.jobs[i]));
	const sharing = [0, 1].map((i) => known.filter((t) => t.supply[i]).length);
	// Allies that supply the damage type the candidate would add.
	const hasOpposite = [
		known.some((t) => t.supply[1]),
		known.some((t) => t.supply[0]),
	];
	return (candidate: Champion) => {
		const { jobs, supply } = traits(candidate);
		let units = 0;
		for (let i = 0; i < JOBS.length; i++) {
			if (jobs[i] && !covered[i]) units += 2;
		}
		for (let i = 0; i < 2; i++) {
			if (!supply[i]) continue;
			const same = sharing[i] as number;
			if (same === 0 && hasOpposite[i]) units += 3;
			if (same >= 2 && candidate.damage === (i === 0 ? "physical" : "magic"))
				units -= 5;
		}
		return units * SCALE;
	};
}
