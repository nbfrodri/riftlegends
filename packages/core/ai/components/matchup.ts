import type { Role } from "@rift-legends/contracts";
import { min, SCALE } from "../../math";
import type { Champion } from "../content-index";
import { canAssign } from "../positions";

/** The rivals that can take `role` while the others still fill distinct lanes. */
export function rivalsInRole(rivals: readonly Champion[], role: Role) {
	return rivals.filter(
		(rival) =>
			rival.positions.some((p) => p.role === role) &&
			canAssign(
				rivals.filter((c) => c !== rival),
				role,
			),
	);
}

/** The worst matchup of the candidate against the rivals that can share its lane. */
export function worstMatchup(
	opponents: ReadonlyMap<string, number> | undefined,
	inRole: readonly Champion[],
): number {
	if (!opponents) return 0;
	let worst: number | undefined;
	for (const rival of inRole) {
		const value = opponents.get(rival.id) ?? 0;
		worst = worst === undefined ? value : min(worst, value);
	}
	return (worst ?? 0) * SCALE;
}
