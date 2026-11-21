import type { MatchEvent } from "@rift-legends/contracts";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Contest } from "./contests/contest";
import { FIGHT_CONTEST } from "./contests/fights";
import { LANE_CONTESTS } from "./contests/lane";
import { OBJECTIVE_CONTESTS } from "./contests/objectives";
import { STRUCTURE_CONTESTS } from "./contests/structures";
import { trackSnapshots } from "./snapshot";
import {
	applyEvents,
	createMatch,
	type MatchSetup,
	type MatchState,
} from "./state";

export type { Contest } from "./contests/contest";
export { LANE_CONTESTS };

/** Every contest of a game, in the order they resolve within a minute. */
export const MATCH_CONTESTS: readonly Contest[] = [
	...LANE_CONTESTS,
	...OBJECTIVE_CONTESTS,
	FIGHT_CONTEST,
	...STRUCTURE_CONTESTS,
];

/** Far past any real game: reaching it means no contest can end the game. */
const RUNAWAY = 120;

export const matchDuration = (last: MatchEvent | undefined): number =>
	last ? (last.minute - 1) * 60 + last.second : 0;

/**
 * Plays one more minute: each due contest draws from its own stream
 * `(seed, match, game, minute, contest)`, so adding one never moves the rest.
 */
export function playMinute(
	state: MatchState,
	contests: readonly Contest[],
): { state: MatchState; events: MatchEvent[] } {
	const { seed, game, rules } = state.context;
	const minute = state.minute + 1;
	const passive = rules.economy.passive;
	const current: MatchState = {
		...state,
		minute,
		blue: { ...state.blue, gold: state.blue.gold + passive },
		red: { ...state.red, gold: state.red.gold + passive },
	};
	const events: MatchEvent[] = contests
		.filter((contest) => contest.due(current))
		.flatMap((contest) =>
			contest
				.resolve(
					current,
					createRng(deriveSeed(seed, SCOPES.match, game, minute, contest.id)),
				)
				.map((event) => ({ game, minute, ...event })),
		)
		// Stable: events of the same second keep the order of the contests.
		.sort((a, b) => a.second - b.second);
	// Nothing happens after the nexus falls.
	const end = events.findIndex((e) => e.kind === "nexus");
	if (end >= 0) events.length = end + 1;
	return { state: applyEvents(current, events), events };
}

/**
 * Plays a whole game: it ends when a nexus falls, never at a set minute.
 * `snapshots` is the map at the start and after each minute (plan 09, Q4).
 */
export function playMatch(setup: MatchSetup, contests: readonly Contest[]) {
	let state = createMatch(setup);
	const events: MatchEvent[] = [];
	const capture = trackSnapshots(state, setup.match);
	const snapshots = [capture(state, [], 0)];
	while (state.winner === null) {
		if (state.minute >= RUNAWAY) {
			throw new Error(`No nexus fell in ${RUNAWAY} minutes`);
		}
		const next = playMinute(state, contests);
		events.push(...next.events);
		state = next.state;
		const elapsed = state.winner
			? matchDuration(next.events.at(-1))
			: state.minute * 60;
		snapshots.push(capture(state, next.events, elapsed));
	}
	return { state, events, snapshots };
}
