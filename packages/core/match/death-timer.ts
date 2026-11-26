import type { MatchContent, Role } from "@rift-legends/contracts";
import { clamp, min } from "../math/int";

type Rules = MatchContent["rules"];

/** Highest level of a champion, and the entries of the BRW table. */
const MAX_LEVEL = 18;
/** The TIF is in thousandths of a point: 100,000 is 100 %. */
const WHOLE = 100_000;

/** `numerator / denominator` rounded half to even, for non-negative integers. */
function roundHalfEven(numerator: number, denominator: number): number {
	const rest = numerator % denominator;
	const whole = (numerator - rest) / denominator;
	if (rest * 2 < denominator) return whole;
	if (rest * 2 > denominator) return whole + 1;
	return whole % 2 === 0 ? whole : whole + 1;
}

/** Integer division of non-negative numbers, rounding down and up. */
const floorDiv = (n: number, d: number) => (n - (n % d)) / d;
const ceilDiv = (n: number, d: number) => floorDiv(n + d - 1, d);

/** Time increase of a death at `second`, in thousandths of a point. */
function increase(timer: Rules["deathTimer"], second: number): number {
	const phase = timer.tif.filter(({ from }) => from <= second).at(-1);
	if (!phase) return 0;
	const steps = ceilDiv(second - phase.from, timer.step);
	return min(phase.base + steps * phase.perStep, timer.cap);
}

/**
 * Second of the game a player who dies at `second` comes back (plan 08, #528):
 * `BRW + BRW × TIF` in tenths of a second, the product rounded half to even,
 * and the whole up to the next second.
 */
export function respawnTime(
	timer: Rules["deathTimer"],
	level: number,
	second: number,
): number {
	const brw = timer.brw[clamp(level, 1, MAX_LEVEL) - 1] as number;
	const tenths = brw + roundHalfEven(brw * increase(timer, second), WHOLE);
	return second + ceilDiv(tenths, 10);
}

/**
 * Level of a role at a second of the game: the median of the pro timelines
 * (#527) until #338 levels each player. The last minute serves longer games.
 */
export function levelAt(
	curve: Rules["levelCurve"],
	role: Role,
	second: number,
): number {
	const minutes = curve[role];
	const tenths = minutes[min(floorDiv(second, 60), minutes.length - 1)];
	return clamp(roundHalfEven(tenths as number, 10), 1, MAX_LEVEL);
}
