import type { Role, Side } from "@rift-legends/contracts";
import { pick } from "../../rng/helpers";
import { attribute } from "../attribution/attribute";
import { aliveRoles, gameSecond } from "../player-state";
import { type MatchState, other } from "../state";
import { type Contest, type ContestEvent, paid, roll } from "./contest";
import { edge, outcome } from "./edge";

type Lane = "top" | "mid" | "bot";

const LANE_MINUTES = new Set([3, 6, 9, 12]);
const GANK_MINUTES = new Set([4, 6, 8, 10, 12, 14]);
/** Gold for winning a lane contest without a kill: plates, farm and pressure. */
const LANE_GOLD = 150;
/** Chance, per 10,000, that a won lane contest ends in a kill. */
const SOLO_KILL = 2500;

export function kill(
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

/**
 * Kills pay one assist bag when the exchange has a second player (the support
 * or the jungler), however many of them help: the number of assists never
 * moves the gold, so it never moves the game (plan 08, R4).
 */
function gold(
	state: MatchState,
	winner: Side,
	kills: ContestEvent["kills"],
	bagged: boolean,
	extra = 0,
) {
	const { economy } = state.context.rules;
	const earned = kills.length * (economy.kill + (bagged ? economy.assist : 0));
	return paid(winner, earned + extra);
}

/** The two laners of `lane` trade for farm, pressure and sometimes a kill. */
const laneContest = (lane: Lane, id: number): Contest => ({
	id,
	due: (state) => LANE_MINUTES.has(state.minute),
	resolve(state, rng, second) {
		const result = edge(state, "lane", {}, lane);
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		const at = gameSecond(state.minute, second);
		const duo = lane === "bot";
		const mine = aliveRoles(state, winner, at);
		// The kill needs the loser's laner up and someone of the winner's lane.
		const scored =
			roll(rng, SOLO_KILL) &&
			aliveRoles(state, other(winner), at).includes(lane) &&
			(duo
				? mine.includes("bot") || mine.includes("support")
				: mine.includes(lane));
		const { killer, assists } = scored
			? attribute(
					state,
					winner,
					duo ? { kind: "duo" } : { kind: "duel", lane },
					{ contest: id, event: 0, kill: 0 },
					mine,
				)
			: { killer: lane, assists: [] as Role[] };
		const kills = scored ? [kill(state, winner, killer, lane, assists)] : [];
		return [
			{
				kind: "lane",
				side: winner,
				zone: `lane-${lane}`,
				second,
				kills,
				gold: gold(state, winner, kills, duo, LANE_GOLD),
				...outcome(result, winner),
			},
		];
	},
});

/** A jungler ganks a lane; if it fails, the laners turn it around. */
const gank: Contest = {
	id: 4,
	due: (state) => GANK_MINUTES.has(state.minute),
	resolve(state, rng, second) {
		const result = edge(state, "jungle");
		const winner: Side = roll(rng, result.blue) ? "blue" : "red";
		const lane = pick(rng, ["top", "mid", "bot"] as const);
		const at = gameSecond(state.minute, second);
		const mine = aliveRoles(state, winner, at);
		// A gank needs the winner's jungler and the loser's laner up.
		const kills =
			mine.includes("jungle") &&
			aliveRoles(state, other(winner), at).includes(lane)
				? (() => {
						const { killer, assists } = attribute(
							state,
							winner,
							{ kind: "gank", lane },
							{ contest: 4, event: 0, kill: 0 },
							mine,
						);
						return [kill(state, winner, killer, lane, assists)];
					})()
				: [];
		return [
			{
				kind: "gank",
				side: winner,
				zone: `lane-${lane}`,
				second,
				kills,
				gold: gold(state, winner, kills, true),
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
