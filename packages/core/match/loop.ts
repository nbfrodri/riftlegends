import type { MatchEvent } from "@rift-legends/contracts";
import { max } from "../math";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng, type Rng } from "../rng/streams";
import type { Contest, ContestEvent } from "./contests/contest";
import { CONVERSION_ID, stepWindow } from "./contests/conversion";
import { FIGHT_CONTEST } from "./contests/fights";
import { LANE_CONTESTS } from "./contests/lane";
import { OBJECTIVE_CONTESTS } from "./contests/objectives";
import { STRUCTURE_CONTESTS } from "./contests/structures";
import { recordPlays } from "./events";
import { recordMultikills } from "./multikills";
import { gameSecond, timeDeaths } from "./player-state";
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

/** One thing to resolve in a minute: a due contest or an attempt of a window. */
type Step = {
	readonly second: number;
	readonly id: number;
	readonly contest?: Contest;
};

const byOrder = (a: Step, b: Step) => a.second - b.second || a.id - b.id;

/**
 * Plays one more minute. Each due contest draws from its own stream
 * `(seed, match, game, minute, contest)`, so adding one never moves the rest,
 * and its first draw is the second it happens at. The contests then resolve
 * one by one in (second, id) order, each over the state the earlier ones
 * left: their deaths, objectives and gold (plan 08, #528). A fight won in
 * numbers opens a window whose attempts take their place in that order, one at
 * a time, and may go on into the next minute (#530).
 */
export function playMinute(
	state: MatchState,
	contests: readonly Contest[],
): { state: MatchState; events: MatchEvent[] } {
	const { seed, game } = state.context;
	const minute = state.minute + 1;
	const start = gameSecond(minute, 0);
	let current: MatchState = {
		...state,
		minute,
		blue: earnPassive(state, "blue", minute),
		red: earnPassive(state, "red", minute),
	};
	const streams = new Map<Contest, Rng>();
	const queue: Step[] = contests
		.filter((contest) => contest.due(current))
		.map((contest) => {
			const rng = createRng(
				deriveSeed(seed, SCOPES.match, game, minute, contest.id),
			);
			streams.set(contest, rng);
			return { contest, id: contest.id, second: int(rng, 0, 59) };
		});
	/** The next attempt of the window, if it falls in this minute. */
	const schedule = () => {
		// One attempt waits at a time: a new window replaces the old one.
		const stale = queue.findIndex((step) => !step.contest);
		if (stale >= 0) queue.splice(stale, 1);
		const at = current.window ? current.window.at - start : 60;
		if (at < 60) queue.push({ id: CONVERSION_ID, second: at > 0 ? at : 0 });
	};
	schedule();
	const events: MatchEvent[] = [];
	// Nothing happens from the second the nexus falls.
	let end = 60;
	while (queue.length > 0) {
		queue.sort(byOrder);
		const step = queue.shift() as Step;
		if (step.second >= end) continue;
		const before = current.window;
		let resolved: ContestEvent[];
		let window = current.window;
		if (step.contest) {
			const rng = streams.get(step.contest) as Rng;
			if (!step.contest.due(current)) continue;
			resolved = step.contest.resolve(current, rng, step.second);
		} else {
			const rng = createRng(
				deriveSeed(
					seed,
					SCOPES.match,
					game,
					minute,
					CONVERSION_ID,
					step.second,
				),
			);
			({ events: resolved, window } = stepWindow(
				current,
				rng,
				events.reduce((latest, e) => max(latest, e.second), 0),
			));
		}
		const clipped: MatchEvent[] = resolved
			.map((event) => ({ game, minute, ...event }))
			.filter((event) => event.second < end);
		const nexus = clipped.findIndex((e) => e.kind === "nexus");
		if (nexus >= 0) clipped.length = nexus + 1;
		const timed = clipped.map((event) => timeDeaths(current, event));
		const recorded = recordPlays(current, timed.map(recordMultikills));
		current = applyEvents(
			{ ...current, plays: recorded.plays },
			recorded.events,
		);
		events.push(...recorded.events);
		if (current.winner !== null) {
			end = recorded.events.find((e) => e.kind === "nexus")?.second ?? end;
		}
		if (!step.contest) {
			current = { ...current, window };
			schedule();
		} else if (current.window !== before) schedule();
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
