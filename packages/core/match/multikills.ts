import type { MatchEvent } from "@rift-legends/contracts";

type Kill = MatchEvent["kills"][number];
const NEXT_TIER = { 1: 2, 2: 3, 3: 4, 4: 5, 5: undefined } as const;
const CHAIN_WINDOW = 10;
const PENTA_WINDOW = 30;

interface Chain {
	last: Kill;
	second: number;
}

/** Fight casualties are chronological and each player can die once per fight. */
export function recordMultikills(event: MatchEvent): MatchEvent {
	if (event.kind !== "fight" || event.kills.length < 2) return event;

	const chains = new Map<string, Chain>();
	const dead = new Set<string>();
	const kills = event.kills.map((original) => {
		const kill = { ...original };
		const { killer, victim, fightSecond } = kill;
		// A repeated casualty would imply a respawn. No chain crosses it.
		if (dead.has(victim) || fightSecond === undefined) chains.clear();
		const previous = chains.get(killer);
		dead.add(victim);
		chains.delete(victim);
		if (fightSecond === undefined || dead.has(killer)) return kill;

		if (previous) {
			const tier = previous.last.multikill ?? 1;
			const next = NEXT_TIER[tier];
			const gap = fightSecond - previous.second;
			const window = tier === 4 ? PENTA_WINDOW : CHAIN_WINDOW;
			if (next && gap >= 0 && gap <= window) {
				delete previous.last.multikill;
				kill.multikill = next;
			}
		}
		chains.set(killer, { last: kill, second: fightSecond });
		return kill;
	});
	return { ...event, kills };
}

/** Summarises the streaks without recalculating the events or individual KDA. */
export function multikillsOf(events: readonly MatchEvent[]) {
	return events.flatMap((fight, event) =>
		fight.kills.flatMap(({ killer, multikill }) =>
			multikill ? [{ event, killer, count: multikill }] : [],
		),
	);
}
