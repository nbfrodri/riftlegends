import type { Role } from "@rift-legends/contracts";
import type { Champion } from "./content-index";

/** Can all prior picks occupy distinct lanes while the candidate takes this role? */
export function canAssign(
	picks: readonly Champion[],
	role: Role,
	complete?: (used: ReadonlySet<Role>) => boolean,
): boolean {
	const used = new Set<Role>([role]);
	function place(i: number): boolean {
		const pick = picks[i];
		if (!pick) return complete?.(used) ?? true;
		for (const { role } of pick.positions) {
			if (used.has(role)) continue;
			used.add(role);
			if (place(i + 1)) return true;
			used.delete(role);
		}
		return false;
	}
	return place(0);
}
