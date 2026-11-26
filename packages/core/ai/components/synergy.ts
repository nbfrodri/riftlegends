import { SCALE } from "../../math";

export function synergy(
	partners: ReadonlyMap<string, number> | undefined,
	picks: readonly string[],
	bans: readonly (string | null)[],
): number {
	if (!partners) return 0;
	let sum = 0;
	for (const id of picks) {
		if (!bans.includes(id)) sum += (partners.get(id) ?? 0) * SCALE;
	}
	return sum;
}
