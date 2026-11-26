import type { MatchContent, Role, Side } from "@rift-legends/contracts";
import { ROLES } from "@rift-legends/contracts";
import { aliveRoles } from "./player-state";
import type { Contest } from "./profile";
import type { Lane, MatchState } from "./state";

/** How much each role counts in a contest: per 10,000, in `rules.presence`. */
export type Weights = Readonly<Record<Role, number>>;

/**
 * Points of the cause `numbers` when one side has all the presence of a
 * contest and the other none. Balance constants, tuned for K19: the side with
 * fewer players up takes a baron, an inhibitor or a tower at most 10 % of the
 * time (plan 08, #529).
 */
const NUMBERS_POINTS: Readonly<Record<Contest, number>> = {
	lane: 10_000_000,
	jungle: 20_000_000,
	fight: 80_000_000,
	objective: 30_000_000,
	siege: 10_000_000,
};

/** The weights a contest counts its players by; a lane counts its own two. */
export const weightsOf = (
	rules: MatchContent["rules"],
	contest: Contest,
	lane: Lane = "top",
): Weights =>
	contest === "lane" ? rules.presence.lane[lane] : rules.presence[contest];

/** Sum of the weights of the roles that are up, from 0 to 10,000. */
export const presenceOf = (weights: Weights, up: readonly Role[]) =>
	up.reduce((sum, role) => sum + weights[role], 0);

/** Who is up on each side in a contest at `second` of the game. */
export const upAt = (state: MatchState, second: number) =>
	({
		blue: aliveRoles(state, "blue", second),
		red: aliveRoles(state, "red", second),
	}) satisfies Record<Side, readonly Role[]>;

/** The roles of a side that were down, in role order. */
export const downOf = (up: readonly Role[]) =>
	ROLES.filter((role) => !up.includes(role));

/** Points of `numbers` for blue: its presence over red's, in the contest's points. */
export const numbersPoints = (contest: Contest, blue: number, red: number) => {
	const scaled = NUMBERS_POINTS[contest] * (blue - red);
	// Whole division toward zero, so that mirrored sides give mirrored points.
	return (scaled - (scaled % 10_000)) / 10_000;
};
