import { int } from "../rng/helpers";
import { createRng } from "../rng/streams";
import type { GoldenCase } from "./golden";

/**
 * Example goldens: ten d100 rolls per seed, turned into facts. They only
 * prove the harness and pin the RNG. The real draft goldens arrive with
 * plan 06 and live in their own module folder.
 */
const rollFacts = (seed: number) => {
	const rng = createRng(seed);
	return Array.from({ length: 10 }, (_, position) => ({
		type: "roll",
		position,
		value: int(rng, 1, 100),
	}));
};

export const goldenCases: GoldenCase[] = [0, 2, 4294967295].map((seed) => ({
	module: "rng",
	seed,
	facts: () => rollFacts(seed),
}));
