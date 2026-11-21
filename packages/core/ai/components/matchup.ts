import type { Role } from "@rift-legends/contracts";
import { min, SCALE } from "../../math";
import type { Champion } from "../content-index";
import { canAssign } from "../positions";

export function matchup(
	opponents: ReadonlyMap<string, number> | undefined,
	role: Role,
	rivals: readonly Champion[],
): number {
	if (!opponents) return 0;
	let worst: number | undefined;
	for (const rival of rivals) {
		if (!rival.positions.some((p) => p.role === role)) continue;
		if (
			!canAssign(
				rivals.filter((c) => c !== rival),
				role,
			)
		)
			continue;
		const value = opponents.get(rival.id) ?? 0;
		worst = worst === undefined ? value : min(worst, value);
	}
	return (worst ?? 0) * SCALE;
}
