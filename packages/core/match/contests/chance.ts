import { SCALE } from "../../math";

/** Edge, in fixed-point points, that gives about 73 % (logistic of 1). */
export const SPREAD = 40 * SCALE;

/** 10,000 / (1 + e^(−x)) for x = 0, ¼, ½ … 4, rounded. No `exp` at run time. */
const LOGISTIC: readonly number[] = [
	5000, 5622, 6225, 6792, 7311, 7773, 8176, 8520, 8808, 9047, 9241, 9399, 9526,
	9627, 9707, 9770, 9820,
];
const STEP = SPREAD / 4;

/** Whole division of non-negative integers. */
const quotient = (a: number, b: number) => (a - (a % b)) / b;

/**
 * Chance, per 10,000, that the side with `edge` wins a contest. Integer
 * interpolation over a logistic table; symmetric around 5,000.
 */
export function chance(edge: number): number {
	const size = edge < 0 ? -edge : edge;
	const index = quotient(size, STEP);
	const at = (i: number) => LOGISTIC[i] ?? 9820;
	const value =
		index >= LOGISTIC.length - 1
			? at(LOGISTIC.length - 1)
			: at(index) + quotient((at(index + 1) - at(index)) * (size % STEP), STEP);
	return edge < 0 ? 10000 - value : value;
}
