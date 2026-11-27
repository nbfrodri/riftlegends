import type { MatchContent, Side } from "@rift-legends/contracts";
import { max } from "../../math";
import type { Rng } from "../../rng/streams";
import type { ConversionWindow } from "../conversion-window";
import { gameSecond } from "../player-state";
import { upAt } from "../presence";
import { LANES, type Lane, type MatchState, other } from "../state";
import { type ContestEvent, paid, roll } from "./contest";
import { edge, outcome } from "./edge";
import { type Objective, objectiveUp } from "./objectives";
import { type Loss, structureEvent, type Target, target } from "./structures";

type Conversion = MatchContent["rules"]["conversion"];

/** The contest id of the conversion: its stream is `(…, minute, 46, second)`. */
export const CONVERSION_ID = 46;

/** The objectives a winner goes for, best first. */
const OBJECTIVES: readonly Objective[] = ["baron", "elder", "dragon", "herald"];

/** How far each structure is along the way to the nexus. */
const progress = (next: Target) =>
	next.kind === "nexus"
		? 6
		: next.kind === "inhibitor"
			? 4
			: next.tier === 4
				? 5
				: next.tier;

/** The structure of `loser` that is furthest along, by lane order on a tie. */
function structure(loser: Loss, minute: number, closing: boolean) {
	let best: { lane: Lane; next: Target } | null = null;
	for (const lane of LANES) {
		const next = target(loser, lane, minute, closing);
		if (next && (!best || progress(next) > progress(best.next))) {
			best = { lane, next };
		}
	}
	return best;
}

type Goal =
	| { kind: "objective"; objective: Objective }
	| { kind: "structure"; lane: Lane; next: Target };

/** What the winner goes for: the nexus, then a baron or elder, then the rest. */
function goal(state: MatchState, side: Side, closing: boolean): Goal | null {
	const found = structure(state[other(side)], state.minute, closing);
	if (found?.next.kind === "nexus") return { kind: "structure", ...found };
	const objective = OBJECTIVES.find((kind) => objectiveUp(state, kind));
	if (objective) return { kind: "objective", objective };
	return found ? { kind: "structure", ...found } : null;
}

const costOf = (cost: Conversion["cost"], taken: Goal) =>
	taken.kind === "objective" ? cost[taken.objective] : cost[taken.next.kind];

/**
 * One attempt of a window at its second (plan 08, #530): the winner decides
 * whether to go at all on the first one, then takes the next thing the state
 * offers if it wins the contest with the players that are up. What the
 * attempt costs in seconds is when the next one starts, and it never starts
 * before an event of the minute that is already told (`earliest`); the window ends when
 * the rival is level, the winner fails or nothing is left to take.
 */
export function stepWindow(
	state: MatchState,
	rng: Rng,
	/** Second of the minute before which an attempt cannot start: the facts already told. */
	earliest = 0,
): { events: ContestEvent[]; window: ConversionWindow | null } {
	const open = state.window;
	const rules = state.context.rules.conversion;
	if (!open) return { events: [], window: null };
	const start = gameSecond(state.minute, 0);
	const now = max(open.at, start + earliest);
	if (state.winner !== null || now >= open.until) {
		return { events: [], window: null };
	}
	if (now >= start + 60) return { events: [], window: open };
	if (!open.started && !roll(rng, rules.commit[open.lead - 1] ?? 0)) {
		return { events: [], window: null };
	}
	const side = open.side;
	const closing =
		upAt(state, now)[other(side)].length <= rules.closeWithUp &&
		state.minute >= rules.nexusFrom;
	const aim = goal(state, side, closing);
	if (!aim) return { events: [], window: null };
	// One draw is kept apart: the contest below starts at the next one.
	rng.next();
	const result = edge(
		state,
		aim.kind === "objective" ? "objective" : "siege",
		{},
		undefined,
		now,
	);
	if ((roll(rng, result.blue) ? "blue" : "red") !== side) {
		return { events: [], window: null };
	}
	const base = {
		side,
		second: now - start,
		kills: [],
		...outcome(result, side),
	};
	const { economy } = state.context.rules;
	const event: ContestEvent =
		aim.kind === "objective"
			? {
					...base,
					kind: aim.objective,
					zone:
						aim.objective === "dragon" || aim.objective === "elder"
							? "dragon-pit"
							: "baron-pit",
					gold: paid(side, economy[aim.objective]),
				}
			: structureEvent(
					aim.next,
					aim.lane,
					side,
					state[other(side)],
					state.minute,
					economy,
					base,
				).event;
	const next = now + costOf(rules.cost, aim);
	return {
		events: [event],
		window:
			event.kind === "nexus" || next >= open.until
				? null
				: { ...open, at: next, started: true },
	};
}
