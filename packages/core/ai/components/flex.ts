import { ROLES, type Role } from "@rift-legends/contracts";
import { SCALE } from "../../math";
import type { Champion, Roster } from "../content-index";
import { canAssign } from "../positions";
import { comfort } from "./comfort";

/** Match all five players to distinct champions, keeping every locked allied pick. */
export function flex(
	candidate: Champion,
	positions: readonly Role[],
	allies: readonly Champion[],
	roster: Roster | undefined,
	unavailable: ReadonlySet<string>,
) {
	if (!roster || roster.size !== ROLES.length || positions.length < 2) return 0;
	const trusted = positions.filter(
		(role) => comfort(roster.get(role), candidate.id) > 0,
	);
	if (trusted.length < 2) return 0;
	const pools = new Map<Role, string[]>();
	for (const [role, player] of roster) {
		pools.set(
			role,
			[...player.mains, ...player.secondary].filter(
				(id) => id !== candidate.id && !unavailable.has(id),
			),
		);
	}
	function canFillRemaining(assigned: ReadonlySet<Role>) {
		const open = ROLES.filter((role) => !assigned.has(role));
		const used = new Set<string>();
		function fill(i: number): boolean {
			const role = open[i];
			if (!role) return true;
			for (const id of pools.get(role) ?? []) {
				if (used.has(id)) continue;
				used.add(id);
				if (fill(i + 1)) return true;
				used.delete(id);
			}
			return false;
		}
		return fill(0);
	}
	const options = trusted.filter((role) =>
		canAssign(allies, role, canFillRemaining),
	).length;
	return options > 1 ? (options - 1) * 2 * SCALE : 0;
}
