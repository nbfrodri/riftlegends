import {
	choiceKind,
	SIDE_CHOICES,
	type Side,
	type SideChoice,
} from "@rift-legends/contracts";
import { pick } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Outcome } from "../server/dispatcher";
import { newGame } from "./game";
import { done, fail, other } from "./outcome";
import type { SeriesConfig, SeriesState } from "./series";

// Split side choice (issue #305): the team with priority takes a map side or
// a draft order, and its rival takes the other kind.

export interface Choice {
	readonly team: string;
	readonly choice: SideChoice;
}

/** What the team choosing now may take: all four with priority, else the other kind. */
export const sideOptions = (state: SeriesState): SideChoice[] => {
	const [taken] = state.choices;
	if (!taken) return [...SIDE_CHOICES];
	return SIDE_CHOICES.filter(
		(option) => choiceKind(option) !== choiceKind(taken.choice),
	);
};

/** Game 1's priority: a draw with the core RNG, without seeding. */
export const drawPriority = (config: SeriesConfig) =>
	pick(createRng(deriveSeed(config.seed, SCOPES.draft, 0)), config.teams);

/** The seed of the AI's side choice: one per game and choice. */
export const sideSeed = (config: SeriesConfig, state: SeriesState) =>
	deriveSeed(config.seed, SCOPES.side, state.game, state.choices.length);

/** Who takes each map side and who picks first, from the two choices. */
const resolve = (config: SeriesConfig, priority: Choice, reply: Choice) => {
	const [side, order] =
		choiceKind(priority.choice) === "side"
			? [priority, reply]
			: [reply, priority];
	const blue = side.choice === "blue" ? side.team : other(config, side.team);
	const red = other(config, blue);
	const first =
		order.choice === "first" ? order.team : other(config, order.team);
	return {
		blue,
		red,
		first,
		firstSide: (first === blue ? "blue" : "red") as Side,
	};
};

/** `side.choose`: records one choice; the second one starts the game. */
export const chooseSide = (
	state: SeriesState,
	config: SeriesConfig,
	{ team, choice }: Choice,
): Outcome<SeriesState> => {
	if (team !== state.chooser) return fail("not-your-turn", { team });
	if (!sideOptions(state).includes(choice)) {
		return fail("wrong-action", {
			expected: choiceKind(choice) === "side" ? "order" : "side",
		});
	}
	const [priority] = state.choices;
	const by = priority ? "rest" : state.game === 1 ? "draw" : "loss";
	const choices = [...state.choices, { team, choice }];
	const chosen = {
		type: "side.chosen",
		game: state.game,
		team,
		kind: choiceKind(choice),
		choice,
		by,
	};
	if (!priority) {
		return done({ ...state, choices, chooser: other(config, team) }, chosen);
	}
	const { blue, red, first, firstSide } = resolve(config, priority, {
		team,
		choice,
	});
	const coached = (team: string) => config.ai?.[config.teams.indexOf(team)];
	const firstToAssign = coached(red) && !coached(blue) ? "red" : "blue";
	return done(
		{
			...state,
			choices,
			phase: "draft",
			chooser: null,
			draft: newGame(blue, red, firstSide, firstToAssign),
		},
		chosen,
		{ type: "game.started", game: state.game, blue, red, first },
	);
};
