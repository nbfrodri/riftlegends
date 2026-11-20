import {
	xoroshiro128plus,
	xoroshiro128plusFromState,
} from "pure-rand/generator/xoroshiro128plus";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";

/** Four int32 words, in the order of `getState()`. JSON-serializable. */
export type RngState = readonly [number, number, number, number];

/**
 * A mutable `xoroshiro128plus` stream (pure-rand 8.4.2). Changing the
 * algorithm or the library version is a `sim_version` change.
 */
export type Rng = RandomGenerator;

export function createRng(seed: number): Rng {
	return xoroshiro128plus(seed);
}

export function restoreRng(state: RngState): Rng {
	if (
		state.length !== 4 ||
		!state.every(
			(word) =>
				Number.isInteger(word) && word >= -0x80000000 && word <= 0x7fffffff,
		)
	) {
		throw new RangeError("RNG state must be four int32 words");
	}
	return xoroshiro128plusFromState(state);
}

export function rngState(rng: Rng): RngState {
	return rng.getState() as unknown as RngState;
}
