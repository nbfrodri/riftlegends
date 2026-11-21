import { SCALE } from "../../math";

export function synergy(
	partners: ReadonlyMap<string, number> | undefined,
	picks: readonly string[],
	bans: readonly (string | null)[],
): number {
	return picks.reduce(
		(sum, id) =>
			bans.includes(id) ? sum : sum + (partners?.get(id) ?? 0) * SCALE,
		0,
	);
}
