import {
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { levelAt, respawnTime } from "./death-timer";
import type { Slot } from "./economy";
import type { MatchState } from "./state";

/**
 * What a player carries through the game. `respawnAt` is the plan 08 #523
 * state; the ultimate (#339) and the summoner spells (#374) join it here.
 */
export interface PlayerState {
	/** Second of the game the player comes back; alive when it is not ahead. */
	readonly respawnAt: number;
	/** Second of the game of the last death; it prices the passive gold lost. */
	readonly diedAt: number;
	/**
	 * Second of the game of the last kill the player took part in. Another
	 * contest of the minute that starts earlier leaves him out: he is still in
	 * the exchange that resolved before it.
	 */
	readonly busyUntil: number;
	/** Second of the game the ultimate is back; it runs while the player is dead (#339). */
	readonly ultReadyAt: number;
}

export type SidePlayers = Readonly<Record<Role, PlayerState>>;

export const startPlayers = (): SidePlayers =>
	Object.fromEntries(
		ROLES.map((role) => [
			role,
			{ respawnAt: 0, diedAt: 0, busyUntil: 0, ultReadyAt: 0 },
		]),
	) as Record<Role, PlayerState>;

/** Second of the game of `second` in `minute` (minutes count from 1). */
export const gameSecond = (minute: number, second: number) =>
	(minute - 1) * 60 + second;

/**
 * Whether the player can take part in something at `second` of the game: he is
 * back from his last death and out of the last exchange he was in.
 */
export const isAlive = (
	state: MatchState,
	side: Side,
	role: Role,
	second: number,
) => {
	const player = state[side].players[role];
	return player.respawnAt <= second && player.busyUntil <= second;
};

/** The roles of `side` that are alive at `second`, in `ROLES` order. */
export const aliveRoles = (state: MatchState, side: Side, second: number) =>
	ROLES.filter((role) => isAlive(state, side, role, second));

/** Second of the game a kill happens: its event plus its place in the fight. */
export const killSecond = (
	event: MatchEvent,
	kill: MatchEvent["kills"][number],
) => gameSecond(event.minute, event.second) + (kill.fightSecond ?? 0);

/** Sets when each victim of an event comes back, by the formula of #528. */
export function timeDeaths(state: MatchState, event: MatchEvent): MatchEvent {
	if (event.kills.length === 0) return event;
	const { slots, rules } = state.context;
	return {
		...event,
		kills: event.kills.map((kill) => {
			const slot = slots.get(kill.victim);
			if (!slot) return kill;
			const second = killSecond(event, kill);
			const level = levelAt(
				rules.levelCurve,
				ROLES[slot.index] as Role,
				second,
			);
			return {
				...kill,
				respawnAt: respawnTime(rules.deathTimer, level, second),
			};
		}),
	};
}

/** Marks the victims of an event as down, and everyone in it as busy until then. */
export function markDeaths(
	state: MatchState,
	event: MatchEvent,
): Record<Side, SidePlayers> {
	if (event.kills.length === 0) {
		return { blue: state.blue.players, red: state.red.players };
	}
	const players = {
		blue: { ...state.blue.players },
		red: { ...state.red.players },
	};
	const take = (
		id: string,
		change: (own: PlayerState) => Partial<PlayerState>,
	) => {
		const slot: Slot | undefined = state.context.slots.get(id);
		if (!slot) return;
		const role = ROLES[slot.index] as Role;
		const own = players[slot.side][role];
		players[slot.side][role] = { ...own, ...change(own) };
	};
	for (const kill of event.kills) {
		const second = killSecond(event, kill);
		const busy = (own: PlayerState) => ({
			busyUntil: own.busyUntil > second ? own.busyUntil : second,
		});
		take(kill.killer, busy);
		for (const id of kill.assists) take(id, busy);
		take(kill.victim, (own) => ({
			...busy(own),
			...(kill.respawnAt === undefined
				? {}
				: { respawnAt: kill.respawnAt, diedAt: second }),
		}));
	}
	return players;
}

/** Puts on cooldown, on both sides, the ultimates a contest counted (#339). */
export function markSpent(
	players: Record<Side, SidePlayers>,
	event: MatchEvent,
): Record<Side, SidePlayers> {
	const { spent } = event;
	if (!spent) return players;
	const next = { blue: { ...players.blue }, red: { ...players.red } };
	for (const side of ["blue", "red"] as const) {
		for (const { role, readyAt } of spent[side]) {
			next[side][role] = { ...next[side][role], ultReadyAt: readyAt };
		}
	}
	return next;
}
