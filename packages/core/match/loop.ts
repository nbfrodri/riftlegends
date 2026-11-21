import type { MatchEvent } from "@rift-legends/contracts";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Contest } from "./contests/lane";
import {
	applyEvents,
	createMatch,
	type MatchSetup,
	type MatchState,
} from "./state";

export { type Contest, LANE_CONTESTS } from "./contests/lane";

/** Far past any real game: reaching it means no contest can end the game. */
const RUNAWAY = 120;

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
	return { state: applyEvents(current, events), events };
}

/** Plays a whole game: it ends when a nexus falls, never at a set minute. */
export function playMatch(setup: MatchSetup, contests: readonly Contest[]) {
	let state = createMatch(setup);
	const events: MatchEvent[] = [];
	while (state.winner === null) {
		if (state.minute >= RUNAWAY) {
			throw new Error(`No nexus fell in ${RUNAWAY} minutes`);
		}
		const next = playMinute(state, contests);
		events.push(...next.events);
		state = next.state;
	}
	return { state, events };
}
