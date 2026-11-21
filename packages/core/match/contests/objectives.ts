import type { Side } from "@rift-legends/contracts";
import { int } from "../../rng/helpers";
import { type MatchState, minuteOf, SOUL } from "../state";
import { type Contest, paid, roll } from "./contest";
import { edge, outcome } from "./edge";

type Objective = "dragon" | "herald" | "baron" | "elder";

/** Edge of a team whose strategy puts this objective first. A balance constant. */
const PRIORITY_POINTS = 30_000;

const soul = (state: MatchState) =>
	state.blue.dragons >= SOUL || state.red.dragons >= SOUL;

const AVAILABLE: Record<Objective, (state: MatchState) => boolean> = {
	dragon: (state) => !soul(state),
	herald: (state) =>
		state.minute < minuteOf(state.context.rules.objectives.baron.first),
	baron: () => true,
	elder: soul,
};

const FAVOURED_BY: Record<Objective, "dragon" | "baron"> = {
	dragon: "dragon",
	elder: "dragon",
	herald: "baron",
	baron: "baron",
};

/** Both teams fight over an objective as soon as it is up. */
const objective = (kind: Objective, id: number): Contest => ({
	id,
	due: (state) =>
		state.minute >= state.objectives[kind] && AVAILABLE[kind](state),
	resolve(state, rng) {
		const priority = (side: Side) =>
			state.context[side].strategy.objectives === FAVOURED_BY[kind]
				? { key: "strategy", points: PRIORITY_POINTS }
				: undefined;
		const result = edge(state, "objective", {
			blue: priority("blue"),
			red: priority("red"),
		});
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		return [
			{
				kind,
				side: winner,
				zone:
					kind === "dragon" || kind === "elder" ? "dragon-pit" : "baron-pit",
				second: int(rng, 0, 59),
				kills: [],
				gold: paid(winner, state.context.rules.economy[kind]),
				...outcome(result, winner),
			},
		];
	},
});

export const OBJECTIVE_CONTESTS: readonly Contest[] = [
	objective("dragon", 10),
	objective("herald", 11),
	objective("baron", 12),
	objective("elder", 13),
];
