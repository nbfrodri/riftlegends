import {
	type MatchContent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";
import { clamp } from "../math/int";
import type { EventFact } from "./explain";

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
 * Per-player stats of a game, from its events (`match.ended`, plan 08).
 * Kill and assist gold goes to who earned it; the rest of the side's gold
 * (passive and objectives) is split evenly, the remainder to the first role.
 */
export function playerStats(
	events: readonly EventFact[],
	teams: Teams,
	rules: MatchContent["rules"],
	duration: number,
): PlayerStats[] {
	const minutes = div(duration + 59, 60);
	const lines = new Map<string, Line>();
	for (const side of SIDES) {
		for (const role of ROLES) {
			lines.set(teams[side].players[role], {
				kills: 0,
				deaths: 0,
				assists: 0,
				gold: 0,
				damage: DAMAGE_PER_MINUTE * minutes,
			});
		}
	}
	const total = { blue: rules.economy.passive * minutes, red: 0 };
	total.red = total.blue;
	const paid = { blue: 0, red: 0 };
	const teamKills = { blue: 0, red: 0 };

	for (const event of events) {
		const winner = event.side;
		for (const side of SIDES) total[side] += event.gold[side];
		// Never pays more than the event gave, so the shared rest stays >= 0.
		let left = event.gold[winner];
		const pay = (line: Line, amount: number) => {
			const given = amount < left ? amount : left;
			line.gold += given;
			left -= given;
			paid[winner] += given;
		};
		for (const k of event.kills) {
			teamKills[winner] += 1;
			const killer = lines.get(k.killer);
			if (killer) {
				killer.kills += 1;
				killer.damage += DAMAGE.kill;
				pay(killer, rules.economy.kill);
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
					pay(helper, rules.economy.assist);
				}
			}
		}
		if (FIGHTS.has(event.kind)) {
			for (const side of SIDES) {
				for (const role of ROLES) {
					const line = lines.get(teams[side].players[role]);
					if (line) line.damage += side === winner ? DAMAGE.won : DAMAGE.lost;
				}
			}
		}
	}

	return SIDES.flatMap((side) => {
		const rest = total[side] - paid[side];
		const share = div(rest, ROLES.length);
		const extra = rest - share * ROLES.length;
		return ROLES.map((role, index) => {
			const player = teams[side].players[role];
			const line = lines.get(player) as Line;
			const involved = line.kills + line.assists;
			const participation =
				teamKills[side] === 0
					? 0
					: clamp(div(involved * SCALE, teamKills[side]), 0, SCALE);
			return {
				player,
				team: teams[side].team,
				champion: teams[side].champions[role],
				kills: line.kills,
				deaths: line.deaths,
				assists: line.assists,
				gold: line.gold + share + (index === 0 ? extra : 0),
				damage: line.damage,
				participation,
				rating: clamp(
					RATING.base +
						RATING.kill * line.kills +
						RATING.assist * line.assists +
						RATING.death * line.deaths +
						div(RATING.participation * participation, SCALE),
					0,
					100,
				),
			};
		});
	});
}
