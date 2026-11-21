import { ROLES, type Role } from "@rift-legends/contracts";

// Until plan 10 brings names and art, a champion shows its id capitalised, its
// initials and a hue derived from the id, as in the approved mockup.

export const championName = (id: string) =>
	id.charAt(0).toUpperCase() + id.slice(1);

export const initials = (id: string) => id.slice(0, 2).toUpperCase();

/** A stable hue (0–359) for the champion's face. */
export function hue(id: string) {
	let hash = 2166136261;
	for (const char of id) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) % 360;
}

/**
 * The role each of a team's five pick slots shows: a pick takes the first of
 * its champion's roles still free; empty slots take the roles left, in order.
 * The real assignment happens in the roles stage.
 */
export function slotRoles(
	picks: readonly string[],
	rolesOf: (champion: string) => readonly Role[],
): Role[] {
	const taken = new Set<Role>();
	const take = (wanted: readonly Role[]) => {
		const role =
			wanted.find((r) => !taken.has(r)) ?? ROLES.find((r) => !taken.has(r));
		if (role) taken.add(role);
		return role;
	};
	const picked = picks.map((champion) => take(rolesOf(champion)));
	const rest = ROLES.filter((r) => !taken.has(r));
	return [...picked, ...rest].filter((r): r is Role => r !== undefined);
}
