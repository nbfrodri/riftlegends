import { ROLES, type Role } from "@rift-legends/contracts";

/**
 * Which pick each player's row shows, as pick indexes in `ROLES` order (null
 * for a free row). In pick order, a pick takes the first of its champion's
 * roles still free, else the first free row. The real assignment happens in
 * the roles stage.
 */
export function pickRows(
	picks: readonly string[],
	rolesOf: (champion: string) => readonly Role[],
): (number | null)[] {
	const rows: (number | null)[] = ROLES.map(() => null);
	const free = (role: Role) => rows[ROLES.indexOf(role)] === null;
	for (const [pick, champion] of picks.entries()) {
		const role = rolesOf(champion).find(free) ?? ROLES.find(free);
		if (role) rows[ROLES.indexOf(role)] = pick;
	}
	return rows;
}
