import type { MatchEvent, Side } from "@rift-legends/contracts";
import type { Emitted } from "../server/dispatcher";
import { decisive } from "./explain";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { type Contest, summarize } from "./profile";
import { createMatch, type MatchSetup } from "./state";
import { playerStats } from "./stats";

const SIDES: readonly Side[] = ["blue", "red"];

/** The contest each kind of event belongs to, for adaptation (F12). */
const CONTEST_OF: Record<MatchEvent["kind"], Contest> = {
	lane: "lane",
	gank: "jungle",
	kill: "fight",
	fight: "fight",
	dragon: "objective",
	herald: "objective",
	baron: "objective",
	elder: "objective",
	siege: "siege",
	tower: "siege",
	inhibitor: "siege",
	nexus: "siege",
};

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
	const swings = decisive(indexed, side);
	const top = swings[0] ? events[swings[0].event] : undefined;
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
			decisive: swings,
		},
	];
	/** Where the winner gained the most: what the loser's coach adapts to. */
	const edge = top ? CONTEST_OF[top.kind] : null;
	return { winner, edge, events, facts };
}
