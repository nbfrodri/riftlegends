import { type MatchEvent, ROLES, type Side } from "@rift-legends/contracts";
import { max, min } from "../math";
import type { Slot } from "./economy";
import { killSecond } from "./player-state";

const MINUTE = 60;

/**
 * Passive income a player loses in `minute` (counted from 1) for the seconds
 * he is down in it: the share of his minute of farm that matches, rounded
 * down (plan 08, #528).
 */
export function lostInMinute(
	farm: number,
	died: number,
	back: number,
	minute: number,
): number {
	const from = max(died, (minute - 1) * MINUTE);
	const to = min(back, minute * MINUTE);
	if (to <= from) return 0;
	const total = farm * (to - from);
	return (total - (total % MINUTE)) / MINUTE;
}

const emptyLoss = () => ({ blue: ROLES.map(() => 0), red: ROLES.map(() => 0) });

/** The minute (counted from 1) of a second of the game. */
const minuteOfSecond = (second: number) =>
	(second - (second % MINUTE)) / MINUTE + 1;

/**
 * What the kills of an event take at once: the seconds each victim is down in
 * the minute he dies in. A kill that spills into the next minute leaves all of
 * it to that minute (see `earnPassive`). Older kills, without `respawnAt`,
 * take nothing.
 */
export function deadNow(
	event: MatchEvent,
	slots: ReadonlyMap<string, Slot>,
	farm: readonly number[],
): Record<Side, number[]> {
	const lost = emptyLoss();
	if (event.kills.length === 0) return lost;
	for (const kill of event.kills) {
		const slot = slots.get(kill.victim);
		if (!slot || kill.respawnAt === undefined) continue;
		const died = killSecond(event, kill);
		const minute = minuteOfSecond(died);
		if (minute !== event.minute) continue;
		lost[slot.side][slot.index] =
			(lost[slot.side][slot.index] as number) +
			lostInMinute(farm[slot.index] as number, died, kill.respawnAt, minute);
	}
	return lost;
}

interface Down {
	readonly side: Side;
	readonly index: number;
	readonly died: number;
	readonly back: number;
	/** The next minute whose slice has not been added yet. */
	next: number;
}

/**
 * Adds up what the kills take, minute by minute, as the state pays it. Asking
 * for later minutes only adds the new slices; asking for an earlier one starts
 * over.
 */
export function trackDown(
	slots: ReadonlyMap<string, Slot>,
	farm: readonly number[],
) {
	const downs: Down[] = [];
	let through = 0;
	let total = emptyLoss();
	return {
		add(event: MatchEvent) {
			for (const kill of event.kills) {
				const slot = slots.get(kill.victim);
				if (!slot || kill.respawnAt === undefined) continue;
				const died = killSecond(event, kill);
				downs.push({
					side: slot.side,
					index: slot.index,
					died,
					back: kill.respawnAt,
					next: minuteOfSecond(died),
				});
			}
		},
		/** Everything taken through `minutes`. */
		through(minutes: number): Record<Side, number[]> {
			if (minutes < through) {
				total = emptyLoss();
				for (const down of downs) down.next = minuteOfSecond(down.died);
			}
			through = minutes;
			for (const down of downs) {
				for (; down.next <= minutes; down.next++) {
					total[down.side][down.index] =
						(total[down.side][down.index] as number) +
						lostInMinute(
							farm[down.index] as number,
							down.died,
							down.back,
							down.next,
						);
				}
			}
			return total;
		},
	};
}

/** Everything the kills of `events` take through `minutes`, as the state pays it. */
export function deadThrough(
	events: readonly MatchEvent[],
	slots: ReadonlyMap<string, Slot>,
	farm: readonly number[],
	minutes: number,
): Record<Side, number[]> {
	const down = trackDown(slots, farm);
	for (const event of events) down.add(event);
	return down.through(minutes);
}
