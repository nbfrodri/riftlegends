import { type MatchEvent, ROLES } from "@rift-legends/contracts";
import type { MatchState } from "../state";

/**
 * Players up on each side when a baron, an inhibitor or a tower falls, from
 * the respawn seconds of the facts alone (K19, plan 08 #529).
 */
export function structureTakes(
	state: MatchState,
	events: readonly MatchEvent[],
) {
	const sideOf = new Map(
		(["blue", "red"] as const).flatMap((side) =>
			ROLES.map((role) => [state.context[side].players[role], side] as const),
		),
	);
	const back = new Map<string, number>();
	const found: { kind: string; ours: number; theirs: number }[] = [];
	for (const e of events) {
		const now = (e.minute - 1) * 60 + e.second;
		if (e.kind === "baron" || e.kind === "inhibitor" || e.kind === "tower") {
			const up = { blue: 0, red: 0 };
			for (const [player, side] of sideOf) {
				if ((back.get(player) ?? 0) <= now) up[side]++;
			}
			found.push({
				kind: e.kind,
				ours: up[e.side],
				theirs: up[e.side === "blue" ? "red" : "blue"],
			});
		}
		for (const k of e.kills) {
			if (k.respawnAt !== undefined) back.set(k.victim, k.respawnAt);
		}
	}
	return found;
}
