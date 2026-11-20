import { uniformInt } from "pure-rand/distribution/uniformInt";
import type { Rng } from "./streams";

/** Uniform integer in `[min, max]`. A single-value range does not consume the stream. */
export function int(rng: Rng, min: number, max: number): number {
	if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
		throw new RangeError("Bounds must be safe integers");
	}
	if (min > max) {
		throw new RangeError(`min ${min} is greater than max ${max}`);
	}
	if (min === max) {
		return min;
	}
	return uniformInt(rng, min, max);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
	if (items.length === 0) {
		throw new RangeError("Cannot pick from an empty list");
	}
	return items[int(rng, 0, items.length - 1)] as T;
}

/** Fisher-Yates over a copy; the input is not mutated. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = int(rng, 0, i);
		[result[i], result[j]] = [result[j] as T, result[i] as T];
	}
	return result;
}

/** Index chosen with probability `weights[i] / sum(weights)`; integer weights only. */
export function weighted(rng: Rng, weights: readonly number[]): number {
	let total = 0;
	for (const weight of weights) {
		if (!Number.isSafeInteger(weight) || weight < 0) {
			throw new RangeError(
				`Weight must be a non-negative integer, got ${weight}`,
			);
		}
		total += weight;
	}
	if (!Number.isSafeInteger(total) || total === 0) {
		throw new RangeError("Weights must sum to a positive safe integer");
	}
	let roll = int(rng, 0, total - 1);
	for (const [index, weight] of weights.entries()) {
		if (roll < weight) {
			return index;
		}
		roll -= weight;
	}
	throw new RangeError("unreachable");
}
