import {
	type MatchContent,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { SCALE } from "../math";
import { clamp } from "../math/int";
import { farmed, paidByRole, type Slot, splitDamage } from "./economy";
import { per30, rate, share } from "./rating";
import { minuteOf } from "./state";

export type { EventFact } from "./explain";

interface SideTeam {
	readonly team: string;
	readonly players: Readonly<Record<Role, string>>;
	readonly champions: Readonly<Record<Role, string>>;
	/** The `vision` attribute (0–100) of each role's player. */
	readonly vision: Readonly<Record<Role, number>>;
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
	/** Simulated vision score of the game (wards placed and cleared). */
	vision: number;
	rating: number;
}

// Estimate damage from kills, assists, deaths, fights and sieges (more for
// winners), plus a flat amount per minute for farm and objectives.
const DAMAGE = { kill: 1500, assist: 600, death: 300, won: 500, lost: 250 };
const DAMAGE_PER_MINUTE = 150;
const FIGHTS = new Set(["fight", "siege"]);

const OBJECTIVES = new Set(["dragon", "herald", "baron", "elder"]);
const PRESSURE = new Set(["lane", "tower"]);
const isVisionZone = (zone: string) =>
	zone.startsWith("jungle") || zone.endsWith("-pit");

/**
 * Vision score per 30 minutes of a player with the reference attribute, by
 * role. The pro mean (Leaguepedia, 4,756 lines of six leagues): the support
 * wards for the team and the jungle clears; the rest barely place any.
 */
const VISION_PER_30: Record<Role, number> = {
	top: 40,
	jungle: 54,
	mid: 40,
	bot: 40,
	support: 127,
};
/** The attribute that scores the reference, and the change per point (bp). */
const VISION_REFERENCE = 66;
const VISION_PER_POINT = 50;
/** Won contests of jungle and pits move the score between ±10 %. */
const VISION_CONTEST = 2000;

/**
 * Vision score of a player: the role's rate over the game length, scaled by
 * the `vision` attribute and by the share of the jungle and pit contests the
 * team won (5,000 without any). Integer and deterministic.
 */
function visionScore(
	role: Role,
	vision: number,
	contested: number | null,
	seconds: number,
): number {
	const attribute = clamp(
		SCALE + VISION_PER_POINT * (vision - VISION_REFERENCE),
		0,
		3 * SCALE,
	);
	const contest =
		SCALE -
		VISION_CONTEST / 2 +
		div(VISION_CONTEST * (contested ?? SCALE / 2), SCALE);
	return div(
		div(VISION_PER_30[role] * seconds * attribute, 1800) * contest,
		SCALE * SCALE,
	);
}

interface Chances {
	won: number;
	total: number;
}
type Contested = "objectives" | "pressure" | "vision";

const SIDES: readonly Side[] = ["blue", "red"];

/** Integer division of non-negative numbers, rounding down. */
const div = (n: number, d: number) => (n - (n % d)) / d;

interface Line {
	kills: number;
	deaths: number;
	assists: number;
	damage: number;
}

/**
 * Records each event once. Every gold has an owner (plan 08, #347): kills and
 * assists pay who made them; lane gold and towers pay the laners; objectives
 * and the rest pay the five; the passive income goes by role farm share.
 */
export function trackPlayerStats(
	teams: Readonly<Record<Side, Pick<SideTeam, "players">>>,
	rules: MatchContent["rules"],
) {
	const slots = SIDES.flatMap((side) =>
		ROLES.map((role) => ({ side, role, player: teams[side].players[role] })),
	);
	const lines = new Map<string, Line>();
	const slotOf = new Map<string, Slot>();
	const sideOf = new Map<string, Side>();
	for (const { player, side, role } of slots) {
		lines.set(player, { kills: 0, deaths: 0, assists: 0, damage: 0 });
		sideOf.set(player, side);
		slotOf.set(player, { side, index: ROLES.indexOf(role) });
	}
	const rest = {
		blue: ROLES.map(() => 0),
		red: ROLES.map(() => 0),
	};
	const teamKills = { blue: 0, red: 0 };
	// What each side won of the objectives, top-lane and jungle contests (R3).
	const chances = Object.fromEntries(
		SIDES.map((side) => [
			side,
			Object.fromEntries(
				(["objectives", "pressure", "vision"] as const).map((k) => [
					k,
					{ won: 0, total: 0 },
				]),
			),
		]),
	) as Record<Side, Record<Contested, Chances>>;
	const contest = (kind: Contested, winner: Side) => {
		for (const side of SIDES) {
			const c = chances[side][kind];
			c.total += 1;
			if (side === winner) c.won += 1;
		}
	};
	const record = (event: MatchEvent) => {
		const winner = event.side;
		if (OBJECTIVES.has(event.kind)) contest("objectives", winner);
		if (PRESSURE.has(event.kind) && event.zone === "lane-top")
			contest("pressure", winner);
		if (isVisionZone(event.zone)) contest("vision", winner);
		const paid = paidByRole(event, slotOf, rules.economy);
		for (const side of SIDES) {
			paid[side].forEach((gold, i) => {
				rest[side][i] = (rest[side][i] as number) + gold;
			});
		}
		for (const k of event.kills) {
			// In a fight both sides can score: a kill is its killer's side's.
			teamKills[sideOf.get(k.killer) ?? winner] += 1;
			const killer = lines.get(k.killer);
			if (killer) {
				killer.kills += 1;
				killer.damage += DAMAGE.kill;
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
				}
			}
		}
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
			damage: number,
		) => T,
	): T[] => {
		// The same passive income every minute, as the loop pays it.
		const income = farmed(rules.economy.passive).map((gold) => gold * minutes);
		const bySide = Object.fromEntries(
			SIDES.map((side) => [
				side,
				splitDamage(
					ROLES.map(
						(role) =>
							(lines.get(teams[side].players[role]) as Line).damage +
							DAMAGE_PER_MINUTE * minutes,
					),
				),
			]),
		) as Record<Side, number[]>;
		return slots.map((slot) => {
			const i = ROLES.indexOf(slot.role);
			const line = lines.get(slot.player) as Line;
			const gold = (rest[slot.side][i] as number) + (income[i] as number);
			return project(slot, line, gold, bySide[slot.side][i] as number);
		});
	};

	return { record, at, teamKills, chances };
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
	// The damage of each team, for the share of every player (R3).
	const teamDamage = { blue: 0, red: 0 };
	for (const { side, damage } of stats.at(minutes, (slot, _l, _g, damage) => ({
		side: slot.side,
		damage,
	})))
		teamDamage[side] += damage;
	return stats.at(minutes, ({ side, role, player }, line, gold, damage) => {
		const { kills, deaths, assists } = line;
		const teamKills = stats.teamKills[side];
		const participation =
			teamKills === 0
				? 0
				: clamp(div((kills + assists) * SCALE, teamKills), 0, SCALE);
		const contested = share(
			stats.chances[side].vision.won,
			stats.chances[side].vision.total,
		);
		const vision = visionScore(
			role,
			teams[side].vision[role],
			contested,
			duration,
		);
		return {
			player,
			team: teams[side].team,
			champion: teams[side].champions[role],
			kills,
			deaths,
			assists,
			gold,
			damage,
			participation,
			vision,
			rating: rate(role, {
				damage: share(damage, teamDamage[side]),
				kills: share(kills, teamKills),
				kp: teamKills === 0 ? null : participation,
				assists: per30(assists, duration),
				deaths: per30(deaths, duration),
				objectives: share(
					stats.chances[side].objectives.won,
					stats.chances[side].objectives.total,
				),
				pressure: share(
					stats.chances[side].pressure.won,
					stats.chances[side].pressure.total,
				),
				vision: duration <= 0 ? null : div(vision * 1800, duration),
			}).rating,
		};
	});
}
