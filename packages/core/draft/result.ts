import type { AiContent, MatchContent, Side } from "@rift-legends/contracts";
import { mentalEdge, type SeriesContext } from "../match/mental";
import { playGame } from "../match/play";
import type { Contest } from "../match/profile";
import type { Emitted, Outcome } from "../server/dispatcher";
import type { GameDraft } from "./game";
import { done, fail, other, WINS_NEEDED } from "./outcome";
import type { SeriesConfig, SeriesState } from "./series";

/** What the mental layer reads about the series, seen from `team`. */
function seriesContext(
	state: SeriesState,
	config: SeriesConfig,
	team: string,
): SeriesContext {
	const results = state.outcomes.map((o) =>
		o.winner === team ? ("win" as const) : ("loss" as const),
	);
	const last = state.outcomes.at(-1);
	const needed = WINS_NEEDED[config.format];
	return {
		game: state.game,
		// Someone wins the series with this game: the last one or an elimination.
		decisive: state.wins.some((w) => w === needed - 1),
		stage: "regular",
		results,
		...(last && last.winner !== team && last.edge
			? { rivalEdge: last.edge }
			: {}),
	};
}

/** Records a finished game and either moves on or ends the series. */
export function finishGame(
	state: SeriesState,
	winner: string,
	played: readonly Emitted[] = [],
	edge: Contest | null = null,
): Outcome<SeriesState> {
	const config = state.config as SeriesConfig;
	const outcomes = [...state.outcomes, { winner, edge }];
	const matches = [...state.matches, played];
	const index = config.teams.indexOf(winner);
	const draft = state.draft as GameDraft;
	const wins: [number, number] = [state.wins[0], state.wins[1]];
	wins[index] = (wins[index] as number) + 1;
	const previous = [
		...state.previous,
		{ [draft.blue]: draft.picks.blue, [draft.red]: draft.picks.red },
	];
	const finished = { type: "game.finished", game: state.game, winner };
	if (wins[index] === WINS_NEEDED[config.format]) {
		return done(
			{
				...state,
				wins,
				previous,
				outcomes,
				matches,
				phase: "over",
				chooser: null,
			},
			...played,
			finished,
			{ type: "series.finished", winner, wins },
		);
	}
	return done(
		{
			...state,
			wins,
			previous,
			outcomes,
			matches,
			game: state.game + 1,
			phase: "side",
			chooser: other(config, winner),
		},
		...played,
		finished,
	);
}

/** Plays the drafted game (plan 08) and records its result. */
export function playResult(
	state: SeriesState,
	config: SeriesConfig,
): Outcome<SeriesState> {
	if (!state.match || !state.content) {
		return fail("invalid-command", { path: "match" });
	}
	const draft = state.draft as GameDraft;
	const { blue, red } = draft.roles as Required<typeof draft.roles>;
	const lineups = {
		blue: { team: draft.blue, roles: blue },
		red: { team: draft.red, roles: red },
	};
	const mental = (side: Side) =>
		mentalEdge(
			state.content as AiContent,
			state.match as MatchContent,
			lineups[side],
			side,
			seriesContext(state, config, lineups[side].team),
		);
	const game = playGame({
		seed: config.seed,
		game: state.game,
		draft: state.content,
		match: state.match,
		...lineups,
		mental: { blue: mental("blue"), red: mental("red") },
	});
	return finishGame(state, game.winner, game.facts, game.edge);
}
