import type { MatchEvent, Role, Side } from "@rift-legends/contracts";
import { int, pick } from "../../rng/helpers";
import type { Rng } from "../../rng/streams";
import { type MatchState, other } from "../state";
import { edge, outcome } from "./edge";

/** An event as a contest makes it; the loop adds the game and minute. */
type ContestEvent = Omit<MatchEvent, "game" | "minute">;

/** A kind of contest the loop resolves when it is due, with its own RNG. */
export interface Contest {
	/** Fixed forever: it feeds the seed of the contest's stream. */
	readonly id: number;
	readonly due: (state: MatchState) => boolean;
	readonly resolve: (state: MatchState, rng: Rng) => ContestEvent[];
}

type Lane = "top" | "mid" | "bot";

const LANE_MINUTES = new Set([3, 6, 9, 12]);
const GANK_MINUTES = new Set([4, 6, 8, 10, 12, 14]);
/** Gold for winning a lane contest without a kill: plates, farm and pressure. */
const LANE_GOLD = 150;
/** Chance, per 10,000, that a won lane contest ends in a kill. */
const SOLO_KILL = 2500;

const roll = (rng: Rng, chance: number) => int(rng, 0, 9999) < chance;

function kill(
	state: MatchState,
	winner: Side,
	killer: Role,
	victim: Role,
	assists: readonly Role[],
) {
	const us = state.context[winner].players;
	return {
		killer: us[killer],
		victim: state.context[other(winner)].players[victim],
		assists: assists.map((role) => us[role]),
	};
}

function gold(
	state: MatchState,
	winner: Side,
	kills: ContestEvent["kills"],
	extra = 0,
) {
	const { economy } = state.context.rules;
	const earned = kills.reduce(
		(sum, k) => sum + economy.kill + economy.assist * k.assists.length,
		extra,
	);
	return winner === "blue"
		? { blue: earned, red: 0 }
		: { blue: 0, red: earned };
}

/** The two laners of `lane` trade for farm, pressure and sometimes a kill. */
const laneContest = (lane: Lane, id: number): Contest => ({
	id,
	due: (state) => LANE_MINUTES.has(state.minute),
	resolve(state, rng) {
		const result = edge(state, "lane");
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		const second = int(rng, 0, 59);
		const assists: Role[] = lane === "bot" ? ["support"] : [];
		const kills = roll(rng, SOLO_KILL)
			? [kill(state, winner, lane, lane, assists)]
			: [];
		return [
			{
				kind: "lane",
				side: winner,
				zone: `lane-${lane}`,
				second,
				kills,
				gold: gold(state, winner, kills, LANE_GOLD),
				...outcome(result, winner),
			},
		];
	},
});

/** A jungler ganks a lane; if it fails, the laners turn it around. */
const gank: Contest = {
	id: 4,
	due: (state) => GANK_MINUTES.has(state.minute),
	resolve(state, rng) {
		const result = edge(state, "jungle");
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		const second = int(rng, 0, 59);
		const lane = pick(rng, ["top", "mid", "bot"] as const);
		const kills = [kill(state, winner, "jungle", lane, [lane])];
		return [
			{
				kind: "gank",
				side: winner,
				zone: `lane-${lane}`,
				second,
				kills,
				gold: gold(state, winner, kills),
				...outcome(result, winner),
			},
		];
	},
};

export const LANE_CONTESTS: readonly Contest[] = [
	laneContest("top", 1),
	laneContest("mid", 2),
	laneContest("bot", 3),
	gank,
];
