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

/** Everything the kills of `events` take through `minutes`, as the state pays it. */
export function deadThrough(
	events: readonly MatchEvent[],
	slots: ReadonlyMap<string, Slot>,
	farm: readonly number[],
	minutes: number,
): Record<Side, number[]> {
	const lost = emptyLoss();
	for (const event of events) {
		for (const kill of event.kills) {
			const slot = slots.get(kill.victim);
			if (!slot || kill.respawnAt === undefined) continue;
			const died = killSecond(event, kill);
			for (let minute = minuteOfSecond(died); minute <= minutes; minute++) {
				lost[slot.side][slot.index] =
					(lost[slot.side][slot.index] as number) +
					lostInMinute(
						farm[slot.index] as number,
						died,
						kill.respawnAt,
						minute,
					);
			}
		}
	}
	return lost;
}
