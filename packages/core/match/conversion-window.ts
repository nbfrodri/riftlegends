import { type MatchEvent, ROLES, type Side } from "@rift-legends/contracts";
import { max } from "../math";
import { gameSecond, killSecond, type SidePlayers } from "./player-state";

/** Seconds after the last kill of a fight before the winner starts pushing. */
export const WINDOW_DELAY = 15;

/**
 * The time a side has to press its numbers after a fight (plan 08, #530): the
 * winner took more players than he lost and chains objectives and structures
 * until the rival has as many up again. It may cross the minute.
 */
export interface ConversionWindow {
	readonly side: Side;
	/** Second of the game the next attempt starts at. */
	readonly at: number;
	/** First second of the game the rival is level with the winner again. */
	readonly until: number;
	/** Players the winner had up over the loser when the window opened. */
	readonly lead: number;
	/** Whether the first attempt, where the winner decides to go, was made. */
	readonly started: boolean;
}

const upAt = (players: SidePlayers, second: number) =>
	ROLES.filter((role) => players[role].respawnAt <= second).length;

/**
 * The window a fight leaves, from the players as the fight left them, or
 * `null` when the winner is not up more players than the loser.
 */
export function openWindow(
	players: Record<Side, SidePlayers>,
	event: MatchEvent,
): ConversionWindow | null {
	const end = event.kills.reduce(
		(latest, kill) => max(latest, killSecond(event, kill)),
		gameSecond(event.minute, event.second),
	);
	const at = end + WINDOW_DELAY;
	const winner = players[event.side];
	const loser = players[event.side === "blue" ? "red" : "blue"];
	const lead = upAt(winner, at) - upAt(loser, at);
	if (lead <= 0) return null;
	const returns = ROLES.flatMap((role) => [
		winner[role].respawnAt,
		loser[role].respawnAt,
	])
		.filter((second) => second > at)
		.sort((a, b) => a - b);
	const until = returns.find(
		(second) => upAt(loser, second) >= upAt(winner, second),
	);
	return until === undefined
		? null
		: { side: event.side, at, until, lead, started: false };
}
