import type { Side } from "@rift-legends/contracts";
import type { MatchCause } from "../cause-keys";
import { gameSecond } from "../player-state";
import { GRUBS, type MatchState, minuteOf, SOUL } from "../state";
import { windowBoost } from "../ultimates";
import { type Contest, paid, roll } from "./contest";
import { edge, outcome, used } from "./edge";
import { trySteal } from "./steal";

export type Objective = "dragon" | "herald" | "baron" | "elder";

/** Chance, per 10,000 and minute, that a spawned baron or elder is contested without a fight. */
const UNFORCED_PIT = 2500;

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

/** Whether the objective has spawned and can be taken now. */
export const objectiveUp = (state: MatchState, kind: Objective) =>
	state.minute >= state.objectives[kind] && AVAILABLE[kind](state);

const FAVOURED_BY: Record<Objective, "dragon" | "baron"> = {
	dragon: "dragon",
	elder: "dragon",
	herald: "baron",
	baron: "baron",
};

/**
 * Chance, per 10,000, that a spawned baron or elder is contested at `at`
 * without a fight: more often for the side with more ultimates ready (#339).
 */
export function pitChance(state: MatchState, at: number) {
	const boost = windowBoost(state, at);
	return (UNFORCED_PIT * (100 + boost.blue + boost.red)) / 100;
}

/** The opening contest decides who controls the pit and starts the objective. */
const objective = (kind: Objective, id: number): Contest => ({
	id,
	due: (state) => objectiveUp(state, kind),
	resolve(state, rng, second) {
		const at = gameSecond(state.minute, second);
		// Nobody walks into the pit on its own: the big objectives are mostly
		// taken in the window after a won fight (plan 08, #530).
		if (
			(kind === "baron" || kind === "elder") &&
			!roll(rng, pitChance(state, at))
		)
			return [];
		const priority = (side: Side): MatchCause | undefined =>
			state.context[side].strategy.objectives === FAVOURED_BY[kind]
				? { key: "strategy", points: PRIORITY_POINTS }
				: undefined;
		const result = edge(
			state,
			"objective",
			{
				blue: priority("blue"),
				red: priority("red"),
			},
			undefined,
			at,
		);
		const controlling: Side = roll(rng, result.blue) ? "blue" : "red";
		const stolen =
			kind === "elder" ? undefined : trySteal(state, controlling, id, at);
		const award = stolen
			? {
					...stolen,
					...(result.down ? { down: result.down } : {}),
					...used(result),
				}
			: {
					side: controlling,
					...outcome(result, controlling),
				};
		return [
			{
				kind,
				zone:
					kind === "dragon" || kind === "elder" ? "dragon-pit" : "baron-pit",
				second,
				kills: [],
				gold: paid(award.side, state.context.rules.economy[kind]),
				...award,
			},
		];
	},
});

/** Chance, per 10,000, that the loser of the group still takes one grub (2-1). */
const GRUB_SPLIT = 1500;

/**
 * The one group of void grubs, a single contest from the first minute until
 * they despawn: the winner usually takes all three, sometimes two and the
 * other side one. It draws from its own stream (contest 14).
 */
const grub: Contest = {
	id: 14,
	due: (state) =>
		state.minute >= state.objectives.grub &&
		state.minute < minuteOf(state.context.rules.objectives.grub.despawn) &&
		state.blue.grubs + state.red.grubs === 0,
	resolve(state, rng, second) {
		const priority = (side: Side): MatchCause | undefined =>
			state.context[side].strategy.objectives === FAVOURED_BY.herald
				? { key: "strategy", points: PRIORITY_POINTS }
				: undefined;
		const result = edge(
			state,
			"objective",
			{
				blue: priority("blue"),
				red: priority("red"),
			},
			undefined,
			gameSecond(state.minute, second),
		);
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		const split = roll(rng, GRUB_SPLIT);
		const grubs = { blue: 0, red: 0, [winner]: split ? GRUBS - 1 : GRUBS };
		if (split) grubs[winner === "blue" ? "red" : "blue"] = 1;
		const { grub: pay } = state.context.rules.economy;
		return [
			{
				kind: "grub",
				side: winner,
				zone: "baron-pit",
				second,
				kills: [],
				grubs,
				gold: { blue: pay * grubs.blue, red: pay * grubs.red },
				...outcome(result, winner),
			},
		];
	},
};

export const OBJECTIVE_CONTESTS: readonly Contest[] = [
	grub,
	objective("dragon", 10),
	objective("herald", 11),
	objective("baron", 12),
	objective("elder", 13),
];
