import { int } from "../rng/helpers";
import { createRng } from "../rng/streams";
import type { GoldenCase } from "./golden";
import { playSeries } from "./play-series";

/**
 * Example goldens: ten d100 rolls per seed, turned into facts. They prove
 * the harness and pin the RNG.
 */
const rollFacts = (seed: number) => {
	const rng = createRng(seed);
	return Array.from({ length: 10 }, (_, position) => ({
		type: "roll",
		position,
		value: int(rng, 1, 100),
	}));
};

const rngCases: GoldenCase[] = [0, 2, 4294967295].map((seed) => ({
	module: "rng",
	seed,
	facts: () => rollFacts(seed),
}));

/** Plan 06, P3: a whole Bo5 with hard fearless and timeouts. */
const DRAFT_POOL = Array.from({ length: 64 }, (_, i) => `c${i}`);
const draftCases: GoldenCase[] = [2026].map((seed) => ({
	module: "draft",
	seed,
	facts: () =>
		playSeries({ seed, format: "bo5", fearless: "hard", pool: DRAFT_POOL }),
}));

export const goldenCases: GoldenCase[] = [...rngCases, ...draftCases];
