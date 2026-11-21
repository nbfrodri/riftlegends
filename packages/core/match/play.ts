import type { Side } from "@rift-legends/contracts";
import type { Emitted } from "../server/dispatcher";
import { decisive } from "./explain";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { summarize } from "./profile";
import { createMatch, type MatchSetup } from "./state";
import { playerStats } from "./stats";

const SIDES: readonly Side[] = ["blue", "red"];

/**
 * Plays a whole game and returns its facts, without positions: the
 * `match.started` summary, one `match.event` per event and `match.ended`.
 * `decisive` points at events by their index within the game.
 */
export function playGame(setup: MatchSetup) {
	const { context } = createMatch(setup);
	const { state, events } = playMatch(setup, MATCH_CONTESTS);
	const side = state.winner as Side;
	const winner = context[side].team;
	const last = events.at(-1);
	const duration = last ? (last.minute - 1) * 60 + last.second : 0;
	const indexed = events.map((event, position) => ({ ...event, position }));
	const teams = {
		blue: {
			team: context.blue.team,
			players: context.blue.players,
			champions: setup.blue.roles,
		},
		red: {
			team: context.red.team,
			players: context.red.players,
			champions: setup.red.roles,
		},
	};
	const facts: Emitted[] = [
		{
			type: "match.started",
			game: setup.game,
			blue: context.blue.team,
			red: context.red.team,
			profiles: Object.fromEntries(
				SIDES.map((s) => [s, summarize(context[s].profile)]),
			),
		},
		...events.map((event) => ({ type: "match.event", ...event })),
		{
			type: "match.ended",
			game: setup.game,
			winner,
			duration,
			players: playerStats(indexed, teams, setup.match.rules, duration),
			decisive: decisive(indexed, side),
		},
	];
	return { winner, events, facts };
}
