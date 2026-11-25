import { type MatchEvent, ROLES } from "@rift-legends/contracts";
import { min } from "../math";
import type { Lane, MatchState } from "./state";

type Kill = MatchEvent["kills"][number];
const FIRST_BLOOD_KILLER = 100;
const FIRST_BLOOD_ASSIST = 50;
const SOLO_GOLD = 50;
const SOLO_EXPERIENCE = 60;
const SOLO_LANES = new Set(["lane-top", "lane-mid"]);
const SPREE_TIERS = [3, 4, 5, 6, 7, 8] as const;
const BOUNTIES = [0, 0, 0, 150, 300, 400, 500, 600, 700] as const;

export const spreeBounty = (kills: number) => BOUNTIES[min(kills, 8)] ?? 0;

export interface MatchPlays {
	readonly streaks: ReadonlyMap<string, number>;
	readonly laneExperience: Readonly<Record<Lane, number>>;
}

export const startPlays = (): MatchPlays => ({
	streaks: new Map(),
	laneExperience: { top: 0, mid: 0, bot: 0 },
});

/**
 * Adds kill-derived facts and their gold in contest order. Inside a fight, a
 * casualty stays down for that exchange unless a later action shows a return.
 */
export function recordPlays(current: MatchState, resolved: MatchEvent[]) {
	if (resolved.every(({ kills }) => kills.length === 0))
		return { plays: current.plays, events: resolved };

	const streaks = new Map(current.plays.streaks);
	const laneExperience = { ...current.plays.laneExperience };
	const { slots } = current.context;
	let withoutKills = current.blue.kills + current.red.kills === 0;
	const events = resolved.map((event) => {
		if (event.kills.length === 0) return event;
		const gold = { ...event.gold };
		const dead = { blue: new Set<string>(), red: new Set<string>() };
		const timedFight =
			event.kind === "fight" &&
			event.kills.every(({ fightSecond }) => fightSecond !== undefined);
		let ace = false;
		const kills = [...event.kills]
			.sort((a, b) => (a.fightSecond ?? 0) - (b.fightSecond ?? 0))
			.map((kill): Kill => {
				const side = slots.get(kill.killer)?.side;
				const victimSide = slots.get(kill.victim)?.side;
				if (!side || !victimSide || side === victimSide) return kill;
				const recorded = { ...kill };
				const shutdown = spreeBounty(streaks.get(kill.victim) ?? 0);
				streaks.delete(kill.victim);
				const count = (streaks.get(kill.killer) ?? 0) + 1;
				streaks.set(kill.killer, count);
				const spree = SPREE_TIERS[count - 3];
				if (spree) recorded.spree = spree;
				if (shutdown > 0) {
					gold[side] += shutdown;
					recorded.shutdown = shutdown;
				}
				if (withoutKills) {
					const assistGold = kill.assists.length > 0 ? FIRST_BLOOD_ASSIST : 0;
					recorded.firstBlood = { killerGold: FIRST_BLOOD_KILLER, assistGold };
					gold[side] += FIRST_BLOOD_KILLER + assistGold;
					withoutKills = false;
				}
				if (
					event.kind === "lane" &&
					SOLO_LANES.has(event.zone) &&
					kill.assists.length === 0
				) {
					const lane = event.zone === "lane-top" ? "top" : "mid";
					recorded.soloKill = true;
					gold[side] += SOLO_GOLD;
					laneExperience[lane] +=
						side === "blue" ? SOLO_EXPERIENCE : -SOLO_EXPERIENCE;
				}
				if (timedFight) {
					dead[side].delete(kill.killer);
					for (const assister of kill.assists) dead[side].delete(assister);
					const alreadyDown = dead[victimSide].has(kill.victim);
					dead[victimSide].add(kill.victim);
					if (!alreadyDown && dead[victimSide].size === ROLES.length) {
						recorded.ace = true;
						ace = true;
					}
				}
				return recorded;
			});
		const causes = ace
			? [...event.causes, { key: "ace", points: 0 }]
			: event.causes;
		return { ...event, kills, gold, causes };
	});
	return { plays: { streaks, laneExperience }, events };
}
