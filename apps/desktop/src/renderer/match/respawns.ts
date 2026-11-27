import type { MatchView } from "@rift-legends/contracts";

/**
 * Who is down at `second` of the game, with the seconds until each respawns
 * (#531). Each kill dies at its event's second plus its second in the fight
 * and comes back at `respawnAt`; a later death replaces an earlier one. Kills
 * from older logs carry no `respawnAt`: their victims stay unknown, not dead.
 */
export function respawnCountdowns(
	facts: MatchView["facts"],
	second: number,
): Map<string, number> {
	const last = new Map<string, { died: number; back: number }>();
	for (const fact of facts) {
		if (fact.type !== "match.event") continue;
		const at = (fact.minute - 1) * 60 + fact.second;
		for (const kill of fact.kills) {
			if (kill.respawnAt === undefined) continue;
			const died = at + (kill.fightSecond ?? 0);
			const known = last.get(kill.victim);
			if (died <= second && (!known || died >= known.died))
				last.set(kill.victim, { died, back: kill.respawnAt });
		}
	}
	const down = new Map<string, number>();
	for (const [player, { back }] of last)
		if (back > second) down.set(player, back - second);
	return down;
}
