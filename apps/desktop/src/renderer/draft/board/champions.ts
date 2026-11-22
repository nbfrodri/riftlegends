import { ROLES, type Role } from "@rift-legends/contracts";

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
