import { ROLES, type Side } from "@rift-legends/contracts";
import { min } from "../../math";
import { int, pick, shuffle } from "../../rng/helpers";
import type { Rng } from "../../rng/streams";
import { type MatchState, other } from "../state";
import { type Contest, roll } from "./contest";
import { edge, MID_GAME, outcome } from "./edge";
import { kill } from "./lane";

const TEMPO_CHANCE = { slow: 1800, balanced: 3000, fast: 4400 } as const;
const EXCHANGE_CHANCE = 3300;
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

function casualties(state: MatchState, side: Side, count: number, rng: Rng) {
	return shuffle(rng, ROLES)
		.slice(0, count)
		.map((victim) => {
			const killer = pick(rng, ROLES);
			const assist = pick(
				rng,
				ROLES.filter((role) => role !== killer),
			);
			return kill(state, side, killer, victim, [assist]);
		});
}

export const FIGHT_CONTEST: Contest = {
	id: 30,
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
		const kills = [
			...casualties(state, winner, won, rng),
			...casualties(state, loser, lost, rng),
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
