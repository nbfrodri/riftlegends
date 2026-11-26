import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import { min } from "../../math";
import { int, pick, shuffle, weighted } from "../../rng/helpers";
import { SCOPES } from "../../rng/scopes";
import { deriveSeed } from "../../rng/seeds";
import { createRng, type Rng } from "../../rng/streams";
import { attribute, type Engagement } from "../attribution/attribute";
import { KILL_BASE } from "../attribution/weights";
import { aliveRoles, gameSecond } from "../player-state";
import { type MatchState, other } from "../state";
import { type Contest, roll } from "./contest";
import { edge, MID_GAME, outcome } from "./edge";
import { kill } from "./lane";

const TEMPO_CHANCE = { slow: 1300, balanced: 2200, fast: 3200 } as const;
const PITS: ReadonlySet<string> = new Set(["dragon-pit", "baron-pit"]);
const EXCHANGE_CHANCE = 2300;
/** Percent of the base fight chance at full teams; the shorthanded fights it removes. */
const FULL_TEAM_BOOST = 145;
const AGGRESSION_POINTS = 25;
const POSITIONING_POINTS = 30;
const ZONES = [
	"jungle-blue-top",
	"jungle-blue-bot",
	"jungle-red-top",
	"jungle-red-bot",
	"dragon-pit",
	"baron-pit",
] as const;

function extraKills(state: MatchState, defended: Side, rng: Rng) {
	const { blue, red } = state.context;
	const aggression = (blue.aggression + red.aggression) * AGGRESSION_POINTS;
	const defense = state.context[defended].positioning * POSITIONING_POINTS;
	const chance = EXCHANGE_CHANCE + aggression - defense;
	let kills = 0;
	for (let i = 1; i < ROLES.length; i++) {
		if (roll(rng, chance)) kills++;
	}
	return kills;
}

/**
 * `count` kills by `side`. Victims come from the contest's stream, among the
 * `down` roles of the other side who are up; who scores and who assists comes
 * from the attribution stream (issue #346), among the `killers` who are up.
 * The two draws that used to pick the killer and the assistant are still taken
 * and dropped, so the rest of the contest draws what it always drew (plan 08, R4).
 */
function casualties(
	state: MatchState,
	side: Side,
	count: number,
	rng: Rng,
	engagement: Engagement,
	first: number,
	pool: {
		victims: readonly Role[];
		killers: readonly Role[];
		/** Who may assist the kill at this place in the fight. */
		helpers?: (index: number) => readonly Role[];
	},
	streaker?: Role,
) {
	return shuffle(rng, ROLES)
		.filter((role) => pool.victims.includes(role))
		.slice(0, count)
		.map((victim, index) => {
			pick(rng, ROLES);
			pick(rng, ROLES.slice(1));
			const drawn = attribute(
				state,
				side,
				engagement,
				{ contest: FIGHT_ID, event: 0, kill: first + index },
				pool.killers,
				pool.helpers?.(index),
			);
			// A rampage: one player takes every kill of the winning side.
			const { killer, assists } = streaker
				? {
						killer: streaker,
						assists: drawn.assists.filter((role) => role !== streaker),
					}
				: drawn;
			return kill(state, side, killer, victim, assists);
		});
}

const FIGHT_ID = 30;

/** Chance per 10,000 that a fight won 5–0 or 4–0 is one player's rampage (K18). */
const RAMPAGE_CHANCE = { 4: 800, 5: 2100 } as const;
/** Slot of the rampage draws in the attribution stream, past every kill slot. */
const RAMPAGE_SLOT = 99;
/**
 * Pro pentakills by role, per mille (Leaguepedia, 277 pentas in 13,607 games
 * of 2021–2025): the ADC is two thirds of them and the support has none.
 */
const RAMPAGE_SHARE: Readonly<Record<Role, number>> = {
	top: 79,
	jungle: 76,
	mid: 177,
	bot: 668,
	support: 5,
};

/** Who rampages, if anyone: drawn from the attribution stream by kill weight. */
function rampage(
	state: MatchState,
	side: Side,
	won: number,
	alive: readonly Role[],
): Role | undefined {
	if (won !== 4 && won !== 5) return undefined;
	const { seed, game } = state.context;
	const rng = createRng(
		deriveSeed(
			seed,
			SCOPES.matchAttribution,
			game,
			state.minute,
			FIGHT_ID,
			0,
			RAMPAGE_SLOT,
		),
	);
	if (!roll(rng, RAMPAGE_CHANCE[won])) return undefined;
	const weights = state.context[side].attribution;
	// The pro share of rampages by role, bent by the team's own kill factors
	// (archetype and attributes): `kill / KILL_BASE` is that factor alone.
	const odds = ROLES.map((role) =>
		alive.includes(role)
			? RAMPAGE_SHARE[role] * (weights[role].kill / KILL_BASE[role])
			: 0,
	);
	return ROLES[weighted(rng, odds)];
}

/**
 * Seconds since the opening kill of each kill of a fight, the loser's `lost`
 * first and the winner's `won` after them. A separate stream, so placing them
 * never moves the resolution or attribution draws.
 */
function killTimes(
	state: MatchState,
	won: number,
	lost: number,
	streak: boolean,
): number[] {
	const { seed, game } = state.context;
	const rng = createRng(
		deriveSeed(seed, SCOPES.matchFightTiming, game, state.minute, FIGHT_ID),
	);
	let fightSecond = 0;
	return Array.from({ length: lost + won }, (_, index) => {
		// `place` counts the winner's kills from 0.
		const place = index - lost;
		if (index > 0) {
			const fifth = place === ROLES.length - 1 && won === ROLES.length;
			// A rampage keeps to the windows of the game: 10 s, 30 s for the fifth.
			const longest = fifth
				? streak
					? 30
					: 32
				: streak && place > 0
					? 10
					: 12;
			fightSecond += int(rng, 1, longest);
		}
		return fightSecond;
	});
}

/** A player who died up to this many seconds before a kill still assists it. */
export const ASSIST_WINDOW = 10;

export const FIGHT_CONTEST: Contest = {
	id: FIGHT_ID,
	due: (state) => state.minute >= MID_GAME,
	resolve(state, rng, second) {
		const { blue, red, rules } = state.context;
		const frequency =
			(TEMPO_CHANCE[blue.strategy.tempo] + TEMPO_CHANCE[red.strategy.tempo]) /
			2;
		// Nobody starts a fight shorthanded: the chance follows the side with
		// fewer players up, over the base tuned for full teams (`FULL_TEAM_BOOST`).
		const now = gameSecond(state.minute, second);
		const present = min(
			aliveRoles(state, "blue", now).length,
			aliveRoles(state, "red", now).length,
		);
		if (
			!roll(
				rng,
				(frequency * present * present * FULL_TEAM_BOOST) /
					(ROLES.length * ROLES.length * 100),
			)
		)
			return [];

		const result = edge(state, "fight");
		const winner = roll(rng, result.blue) ? "blue" : "red";
		const loser = other(winner);
		const zone = pick(rng, ZONES);
		const at = gameSecond(state.minute, second);
		const up = {
			winner: aliveRoles(state, winner, at),
			loser: aliveRoles(state, loser, at),
		};
		const drawn = 1 + extraKills(state, loser, rng);
		const wanted = min(drawn - 1, extraKills(state, winner, rng));
		// A fight needs someone up on each side; nobody dies twice.
		if (up.winner.length === 0 || up.loser.length === 0) return [];
		const won = min(drawn, up.loser.length);
		// The loser's kills come first, while all of his team is up, and the
		// winner's after them: his killers are the ones they left standing.
		const lost = min(min(wanted, up.winner.length - 1), won - 1);
		// A team fight is at an objective pit or leaves four or more dead.
		const engagement: Engagement =
			PITS.has(zone) || won + lost >= 4
				? { kind: "teamfight" }
				: { kind: "skirmish" };
		const kills = casualties(state, loser, lost, rng, engagement, 0, {
			victims: up.winner,
			killers: up.loser,
		});
		const winnerNames = state.context[winner].players;
		const fell = new Map(
			kills.map(({ victim }, index) => [victim, index] as const),
		);
		const standing = up.winner.filter((role) => !fell.has(winnerNames[role]));
		const streaker = rampage(state, winner, won, standing);
		const times = killTimes(state, won, lost, streaker !== undefined);
		kills.push(
			...casualties(
				state,
				winner,
				won,
				rng,
				engagement,
				lost,
				{
					victims: up.loser,
					killers: standing,
					// The ones killed a moment ago still get their assists.
					helpers: (index) =>
						up.winner.filter((role) => {
							const died = fell.get(winnerNames[role]);
							return (
								died === undefined ||
								(times[lost + index] as number) - (times[died] as number) <=
									ASSIST_WINDOW
							);
						}),
				},
				streaker,
			),
		);
		const { kill: killGold, assist } = rules.economy;
		const wonGold = won * (killGold + assist);
		const lostGold = lost * (killGold + assist);
		return [
			{
				kind: "fight",
				side: winner,
				zone,
				second,
				kills: kills.map((kill, index) => ({
					...kill,
					fightSecond: times[index] as number,
				})),
				gold:
					winner === "blue"
						? { blue: wonGold, red: lostGold }
						: { blue: lostGold, red: wonGold },
				...outcome(result, winner),
			},
		];
	},
};
