import {
	type MatchContent,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";
import { clamp } from "../math/int";
import { minuteOf } from "./state";

export type { EventFact } from "./explain";

interface SideTeam {
	readonly team: string;
	readonly players: Readonly<Record<Role, string>>;
	readonly champions: Readonly<Record<Role, string>>;
}

export interface Teams {
	readonly blue: SideTeam;
	readonly red: SideTeam;
}

/** One line of `match.ended`. `participation` is per 10,000. */
export interface PlayerStats {
	player: string;
	team: string;
	champion: string;
	kills: number;
	deaths: number;
	assists: number;
	gold: number;
	damage: number;
	participation: number;
	rating: number;
}

// Damage is not in the facts, so it is estimated from what is: a kill,
// an assist and a death each leave their damage; every player of a fight or
// siege adds a share (more for the winners); farm and objectives add a flat
// amount per minute.
const DAMAGE = { kill: 1500, assist: 600, death: 300, won: 500, lost: 250 };
const DAMAGE_PER_MINUTE = 150;
const FIGHTS = new Set(["fight", "siege"]);

/** 60 for a quiet game; kills, assists, deaths and participation move it. */
const RATING = { base: 60, kill: 6, assist: 3, death: -5, participation: 10 };

const SIDES: readonly Side[] = ["blue", "red"];

/** Integer division of non-negative numbers, rounding down. */
const div = (n: number, d: number) => (n - (n % d)) / d;

interface Line {
	kills: number;
	deaths: number;
	assists: number;
	/** Kill and assist gold only; the shared gold is added at the end. */
	gold: number;
	damage: number;
}

/**
 * Records each event once. Kill and assist gold goes to who earned it.
 * All other gold is shared evenly, with the remainder going to the first role.
 */
export function trackPlayerStats(
	teams: Readonly<Record<Side, Pick<SideTeam, "players">>>,
	rules: MatchContent["rules"],
) {
	const slots = SIDES.flatMap((side) =>
		ROLES.map((role) => ({ side, role, player: teams[side].players[role] })),
	);
	const lines = new Map<string, Line>();
	const sideOf = new Map<string, Side>();
	for (const { player, side } of slots) {
		lines.set(player, { kills: 0, deaths: 0, assists: 0, gold: 0, damage: 0 });
		sideOf.set(player, side);
	}
	const shared = { blue: 0, red: 0 };
	const teamKills = { blue: 0, red: 0 };

	const record = (event: MatchEvent) => {
		const winner = event.side;
		// Each side pays its own killers from what it earned in the event, and
		// never more, so the shared rest stays >= 0.
		const left = { blue: event.gold.blue, red: event.gold.red };
		const pay = (side: Side, line: Line, amount: number) => {
			const given = amount < left[side] ? amount : left[side];
			line.gold += given;
			left[side] -= given;
		};
		for (const k of event.kills) {
			// In a fight both sides can score: a kill is its killer's side's.
			const side = sideOf.get(k.killer) ?? winner;
			teamKills[side] += 1;
			const killer = lines.get(k.killer);
			if (killer) {
				killer.kills += 1;
				killer.damage += DAMAGE.kill;
				pay(side, killer, rules.economy.kill);
			}
			const victim = lines.get(k.victim);
			if (victim) {
				victim.deaths += 1;
				victim.damage += DAMAGE.death;
			}
			for (const id of k.assists) {
				const helper = lines.get(id);
				if (helper) {
					helper.assists += 1;
					helper.damage += DAMAGE.assist;
					pay(side, helper, rules.economy.assist);
				}
			}
		}
		for (const side of SIDES) shared[side] += left[side];
		if (FIGHTS.has(event.kind)) {
			for (const { player, side } of slots) {
				const line = lines.get(player) as Line;
				line.damage += side === winner ? DAMAGE.won : DAMAGE.lost;
			}
		}
	};

	const at = <T>(
		minutes: number,
		project: (
			slot: (typeof slots)[number],
			line: Readonly<Line>,
			gold: number,
		) => T,
	): T[] => {
		const passive = rules.economy.passive * minutes;
		return slots.map((slot) => {
			const rest = shared[slot.side] + passive;
			const share = div(rest, ROLES.length);
			const extra = slot.role === ROLES[0] ? rest % ROLES.length : 0;
			const line = lines.get(slot.player) as Line;
			return project(slot, line, line.gold + share + extra);
		});
	};

	return { record, at, teamKills };
}

/** Per-player stats of a game, from its events (`match.ended`, plan 08). */
export function playerStats(
	events: readonly MatchEvent[],
	teams: Teams,
	rules: MatchContent["rules"],
	duration: number,
): PlayerStats[] {
	const stats = trackPlayerStats(teams, rules);
	for (const event of events) stats.record(event);
	const minutes = minuteOf(duration);
	return stats.at(minutes, ({ side, role, player }, line, gold) => {
		const { kills, deaths, assists, damage } = line;
		const teamKills = stats.teamKills[side];
		const participation =
			teamKills === 0
				? 0
				: clamp(div((kills + assists) * SCALE, teamKills), 0, SCALE);
		return {
			player,
			team: teams[side].team,
			champion: teams[side].champions[role],
			kills,
			deaths,
			assists,
			gold,
			damage: damage + DAMAGE_PER_MINUTE * minutes,
			participation,
			rating: clamp(
				RATING.base +
					RATING.kill * kills +
					RATING.assist * assists +
					RATING.death * deaths +
					div(RATING.participation * participation, SCALE),
				0,
				100,
			),
		};
	});
}
