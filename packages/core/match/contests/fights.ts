import { ROLES, type Side } from "@rift-legends/contracts";
import { min } from "../../math";
import { int, pick, shuffle } from "../../rng/helpers";
import type { Rng } from "../../rng/streams";
import { attribute, type Engagement } from "../attribution/attribute";
import { type MatchState, other } from "../state";
import { type Contest, roll } from "./contest";
import { edge, MID_GAME, outcome } from "./edge";
import { kill } from "./lane";

const TEMPO_CHANCE = { slow: 1300, balanced: 2200, fast: 3200 } as const;
const PITS: ReadonlySet<string> = new Set(["dragon-pit", "baron-pit"]);
const EXCHANGE_CHANCE = 2300;
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
 * `count` kills by `side`. Victims come from the contest's stream; who scores
 * and who assists comes from the attribution stream (issue #346). The two
 * draws that used to pick the killer and the assistant are still taken and
 * dropped, so the rest of the contest draws what it always drew (plan 08, R4).
 */
function casualties(
	state: MatchState,
	side: Side,
	count: number,
	rng: Rng,
	engagement: Engagement,
	first: number,
) {
	return shuffle(rng, ROLES)
		.slice(0, count)
		.map((victim, index) => {
			pick(rng, ROLES);
			pick(rng, ROLES.slice(1));
			const { killer, assists } = attribute(state, side, engagement, {
				contest: FIGHT_ID,
				event: 0,
				kill: first + index,
			});
			return kill(state, side, killer, victim, assists);
		});
}

const FIGHT_ID = 30;

export const FIGHT_CONTEST: Contest = {
	id: FIGHT_ID,
	due: (state) => state.minute >= MID_GAME,
	resolve(state, rng) {
		const { blue, red, rules } = state.context;
		const frequency =
			(TEMPO_CHANCE[blue.strategy.tempo] + TEMPO_CHANCE[red.strategy.tempo]) /
			2;
		if (!roll(rng, frequency)) return [];

		const result = edge(state, "fight");
		const winner = roll(rng, result.blue) ? "blue" : "red";
		const loser = other(winner);
		const zone = pick(rng, ZONES);
		const second = int(rng, 0, 59);
		const won = 1 + extraKills(state, loser, rng);
		const lost = min(won - 1, extraKills(state, winner, rng));
		// A team fight is at an objective pit or leaves four or more dead.
		const engagement: Engagement =
			PITS.has(zone) || won + lost >= 4
				? { kind: "teamfight" }
				: { kind: "skirmish" };
		const kills = [
			...casualties(state, winner, won, rng, engagement, 0),
			...casualties(state, loser, lost, rng, engagement, won),
		];
		const { kill: killGold, assist } = rules.economy;
		const wonGold = won * (killGold + assist);
		const lostGold = lost * (killGold + assist);
		return [
			{
				kind: "fight",
				side: winner,
				zone,
				second,
				kills,
				gold:
					winner === "blue"
						? { blue: wonGold, red: lostGold }
						: { blue: lostGold, red: wonGold },
				...outcome(result, winner),
			},
		];
	},
};
