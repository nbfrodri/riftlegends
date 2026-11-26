import type { MatchEvent } from "@rift-legends/contracts";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Contest } from "./contests/contest";
import { FIGHT_CONTEST } from "./contests/fights";
import { LANE_CONTESTS } from "./contests/lane";
import { OBJECTIVE_CONTESTS } from "./contests/objectives";
import { STRUCTURE_CONTESTS } from "./contests/structures";
import { recordPlays } from "./events";
import { recordMultikills } from "./multikills";
import { timeDeaths } from "./player-state";
import { trackSnapshots } from "./snapshot";
import {
	applyEvents,
	createMatch,
	earnPassive,
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
 * Plays one more minute. Each due contest draws from its own stream
 * `(seed, match, game, minute, contest)`, so adding one never moves the rest,
 * and its first draw is the second it happens at. The contests then resolve
 * one by one in (second, id) order, each over the state the earlier ones
 * left: their deaths, objectives and gold (plan 08, #528).
 */
export function playMinute(
	state: MatchState,
	contests: readonly Contest[],
): { state: MatchState; events: MatchEvent[] } {
	const { seed, game } = state.context;
	const minute = state.minute + 1;
	let current: MatchState = {
		...state,
		minute,
		blue: earnPassive(state, "blue", minute),
		red: earnPassive(state, "red", minute),
	};
	const due = contests
		.filter((contest) => contest.due(current))
		.map((contest) => {
			const rng = createRng(
				deriveSeed(seed, SCOPES.match, game, minute, contest.id),
			);
			return { contest, rng, second: int(rng, 0, 59) };
		})
		.sort((a, b) => a.second - b.second || a.contest.id - b.contest.id);
	const events: MatchEvent[] = [];
	// Nothing happens from the second the nexus falls.
	let end = 60;
	for (const { contest, rng, second } of due) {
		if (second >= end) continue;
		const resolved: MatchEvent[] = contest
			.resolve(current, rng, second)
			.map((event) => ({ game, minute, ...event }))
			.filter((event) => event.second < end);
		const nexus = resolved.findIndex((e) => e.kind === "nexus");
		if (nexus >= 0) resolved.length = nexus + 1;
		const timed = resolved.map((event) => timeDeaths(current, event));
		const recorded = recordPlays(current, timed.map(recordMultikills));
		current = applyEvents(
			{ ...current, plays: recorded.plays },
			recorded.events,
		);
		events.push(...recorded.events);
		if (current.winner !== null) {
			end = recorded.events.find((e) => e.kind === "nexus")?.second ?? end;
		}
	}
	// Stable: events of the same second keep the order they resolved in.
	return { state: current, events: events.sort((a, b) => a.second - b.second) };
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
