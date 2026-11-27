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

/** Pro grouping of deaths into a fight (tools/data-pipeline/timelines.ts). */
const FIGHT_GAP = 15;
const CONVERSION_WINDOW = 60;
const LATE_FROM = 25 * 60;

/**
 * What K20 and K21 read, with the pro pipeline's own definitions: deaths at
 * most 15 s apart are one fight, won by the side that lost fewer. A fight is
 * converted when the winner takes a baron, dragon, herald, tower or inhibitor
 * in the next 60 s; a late fight (from minute 25, 4+ dead on the loser) closes
 * when the winner ends the game in that time. `deadAtEnd` counts the losing
 * players still down when the nexus falls.
 */
export function fightOutcomes(
	state: MatchState,
	events: readonly MatchEvent[],
) {
	const sideOf = new Map(
		(["blue", "red"] as const).flatMap((side) =>
			ROLES.map((role) => [state.context[side].players[role], side] as const),
		),
	);
	const at = (e: MatchEvent, extra = 0) =>
		(e.minute - 1) * 60 + e.second + extra;
	const deaths = events
		.flatMap((e) =>
			e.kills.map((k) => ({
				second: at(e, k.fightSecond ?? 0),
				side: sideOf.get(k.victim),
			})),
		)
		.sort((a, b) => a.second - b.second);
	const fights: {
		first: number;
		last: number;
		lost: Record<string, number>;
	}[] = [];
	for (const { second, side } of deaths) {
		if (!side) continue;
		const current = fights.at(-1);
		if (current && second - current.last <= FIGHT_GAP) {
			current.last = second;
			current.lost[side] = (current.lost[side] ?? 0) + 1;
		} else fights.push({ first: second, last: second, lost: { [side]: 1 } });
	}
	const taken = events
		.filter((e) =>
			["baron", "dragon", "herald", "tower", "inhibitor"].includes(e.kind),
		)
		.map((e) => ({ second: at(e), side: e.side }));
	const end = events.at(-1);
	const last = end ? at(end) : 0;
	const results: {
		margin: 1 | 2 | 3;
		converted: boolean;
		late: boolean;
		closed: boolean;
	}[] = [];
	for (const fight of fights) {
		const blue = fight.lost.blue ?? 0;
		const red = fight.lost.red ?? 0;
		const margin = blue > red ? blue - red : red - blue;
		if (margin === 0) continue;
		const winner = blue < red ? "blue" : "red";
		const lost = winner === "blue" ? red : blue;
		const late = fight.first >= LATE_FROM && lost >= 4;
		results.push({
			margin: margin > 3 ? 3 : (margin as 1 | 2 | 3),
			converted: taken.some(
				(t) =>
					t.side === winner &&
					t.second > fight.last &&
					t.second <= fight.last + CONVERSION_WINDOW,
			),
			late,
			closed:
				late &&
				state.winner === winner &&
				last - fight.last <= CONVERSION_WINDOW,
		});
	}
	const loser = state.winner === "blue" ? "red" : "blue";
	return { fights: results, deadAtEnd: deadAt(state, events, loser, last) };
}

/** Players of `side` still down at `second`, from the respawn seconds of the facts. */
function deadAt(
	state: MatchState,
	events: readonly MatchEvent[],
	side: "blue" | "red",
	second: number,
) {
	const mine = new Set(ROLES.map((role) => state.context[side].players[role]));
	const back = new Map<string, number>();
	for (const e of events) {
		for (const k of e.kills) {
			if (k.respawnAt !== undefined && mine.has(k.victim)) {
				back.set(k.victim, k.respawnAt);
			}
		}
	}
	return [...back.values()].filter((at) => at > second).length;
}
