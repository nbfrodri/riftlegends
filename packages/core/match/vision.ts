import type { Role } from "@rift-legends/contracts";
import { SCALE } from "../math";
import { clamp } from "../math/int";

/** Integer division of non-negative numbers, rounding down. */
const div = (n: number, d: number) => (n - (n % d)) / d;

/**
 * Vision score per 30 minutes of a player with the reference attribute, by
 * role. The pro mean (Leaguepedia, 4,756 lines of six leagues): the support
 * wards for the team and the jungle clears; the rest barely place any.
 */
const VISION_PER_30: Record<Role, number> = {
	top: 40,
	jungle: 54,
	mid: 40,
	bot: 40,
	support: 127,
};
/** The attribute that scores the reference, and the change per point (bp). */
const VISION_REFERENCE = 66;
const VISION_PER_POINT = 50;
/** Won contests of jungle and pits move the score between ±10 %. */
const VISION_CONTEST = 2000;

/**
 * Vision score of a player: the role's rate over the game length, scaled by
 * the `vision` attribute and by the share of the jungle and pit contests the
 * team won (5,000 without any). Integer and deterministic.
 */
export function visionScore(
	role: Role,
	vision: number,
	contested: number | null,
	seconds: number,
): number {
	const attribute = clamp(
		SCALE + VISION_PER_POINT * (vision - VISION_REFERENCE),
		0,
		3 * SCALE,
	);
	const contest =
		SCALE -
		VISION_CONTEST / 2 +
		div(VISION_CONTEST * (contested ?? SCALE / 2), SCALE);
	return div(
		div(VISION_PER_30[role] * seconds * attribute, 1800) * contest,
		SCALE * SCALE,
	);
}
