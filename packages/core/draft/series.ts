import type {
	AiContent,
	AiSettings,
	CoreError,
	MatchContent,
	Side,
} from "@rift-legends/contracts";
import { playGame } from "../match/play";
import { pick } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { CommandHandler, Emitted, Outcome } from "../server/dispatcher";
import {
	type AvailabilityInput,
	availability,
	checkChampion,
	type Fearless,
	type Format,
	requiredPool,
} from "./availability";
import {
	act,
	assignRoles,
	type GameDraft,
	newGame,
	type Roles,
	turn,
} from "./game";

export interface SeriesConfig {
	readonly teams: readonly [string, string];
	/** Lower is better. Without seeds, game 1's sides are drawn. */
	readonly seeds?: readonly [number, number];
	readonly format: Format;
	readonly fearless: Fearless;
	readonly timer: boolean;
	readonly pool: readonly string[];
	readonly seed: number;
	/** Which teams the AI plays, in `teams` order (plan 07). */
	readonly ai?: readonly [AiSettings | null, AiSettings | null];
}

export interface SeriesState {
	readonly config: SeriesConfig | null;
	readonly phase: "idle" | "side" | "draft" | "result" | "over";
	/** Number of the current (or next) game, from 1. */
	readonly game: number;
	/** Wins in the order of `config.teams`. */
	readonly wins: readonly [number, number];
	/** Team that must choose a side before the next game. */
	readonly chooser: string | null;
	readonly draft: GameDraft | null;
	/** Picks of each finished game, by team. */
	readonly previous: readonly Readonly<Record<string, readonly string[]>>[];
	/** What the draft AI reads; loaded with the session, not sent in commands. */
	readonly content: AiContent | null;
	/** What the match simulation reads (plan 08); loaded the same way. */
	readonly match: MatchContent | null;
}

export const initialSeries: SeriesState = {
	config: null,
	phase: "idle",
	game: 0,
	wins: [0, 0],
	chooser: null,
	draft: null,
	previous: [],
	content: null,
	match: null,
};

export const WINS_NEEDED: Record<Format, number> = { bo1: 1, bo3: 2, bo5: 3 };

export const fail = (
	code: CoreError["code"],
	params: CoreError["params"] = {},
): Outcome<SeriesState> => ({ ok: false, error: { code, params } });

export const done = (
	state: SeriesState,
	...facts: Emitted[]
): Outcome<SeriesState> => ({ ok: true, state, facts });

const other = (config: SeriesConfig, team: string) =>
	config.teams[0] === team ? config.teams[1] : config.teams[0];

/** The sides of a game once `team` takes `side`. */
const startGame = (
	state: SeriesState,
	config: SeriesConfig,
	team: string,
	side: Side,
	by: "seed" | "draw" | "choice",
) => {
	const rival = other(config, team);
	const [blue, red] = side === "blue" ? [team, rival] : [rival, team];
	return {
		state: {
			...state,
			phase: "draft" as const,
			chooser: null,
			draft: newGame(blue, red),
		},
		facts: [
			{ type: "side.chosen", game: state.game, team, side, by },
			{ type: "game.started", game: state.game, blue, red },
		],
	};
};

/** Whatever the series knows that decides which champions are free. */
export const availabilityInput = (
	config: SeriesConfig,
	state: SeriesState,
): AvailabilityInput => ({
	pool: config.pool,
	fearless: config.fearless,
	previous: state.previous,
	bans: state.draft ? [...state.draft.bans.blue, ...state.draft.bans.red] : [],
	picks: state.draft
		? {
				[state.draft.blue]: state.draft.picks.blue,
				[state.draft.red]: state.draft.picks.red,
			}
		: {},
});

/** Runs `handler` only in the phases where the command makes sense. */
const during =
	<P>(
		phase: SeriesState["phase"],
		expected: string,
		handler: (
			state: SeriesState,
			config: SeriesConfig,
			payload: P,
		) => Outcome<SeriesState>,
	): CommandHandler<SeriesState> =>
	(state, payload: P) => {
		if (state.phase === "over") return fail("series-over");
		if (!state.config || state.phase !== phase) {
			return fail("wrong-action", { expected });
		}
		return handler(state, state.config, payload);
	};

/** Applies a ban or a pick once its champion is known to be legal. */
export const apply = (
	state: SeriesState,
	team: string,
	action: "ban" | "pick",
	champion: string | null,
	timeout: boolean,
): Outcome<SeriesState> => {
	const next = act(state.draft as GameDraft, team, action, champion);
	if (!next.ok) return next;
	return done(
		{ ...state, draft: next.value },
		{
			type: action === "ban" ? "draft.banned" : "draft.picked",
			game: state.game,
			team,
			champion,
			timeout,
		},
	);
};

const draftAction = (action: "ban" | "pick") =>
	during<{ team: string; champion: string | null }>(
		"draft",
		action,
		(state, config, { team, champion }) => {
			if (champion !== null) {
				const free = checkChampion(
					availabilityInput(config, state),
					team,
					action,
					champion,
				);
				if (!free.ok) return { ok: false, error: free.error };
			}
			return apply(state, team, action, champion, false);
		},
	);

/**
 * The UI's timer ran out (the core has no clock): an empty ban, or a free
 * champion drawn from the `draft` RNG scope for this game and step.
 */
const timeout = during<Record<string, never>>(
	"draft",
	"ban",
	(state, config) => {
		if (!config.timer) return fail("timer-off");
		const draft = state.draft as GameDraft;
		const next = turn(draft);
		if (!next || next.action === "roles") {
			return fail("wrong-action", { expected: next?.action ?? "none" });
		}
		if (next.action === "ban")
			return apply(state, next.team, "ban", null, true);
		const free = availability(availabilityInput(config, state), next.team)
			.filter((entry) => entry.status === "free")
			.map((entry) => entry.champion);
		const rng = createRng(
			deriveSeed(config.seed, SCOPES.draft, state.game, draft.step),
		);
		return apply(state, next.team, "pick", pick(rng, free), true);
	},
);

/** Records a finished game and either moves on or ends the series. */
function finish(
	state: SeriesState,
	config: SeriesConfig,
	winner: string,
	played: readonly Emitted[] = [],
): Outcome<SeriesState> {
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
			{ ...state, wins, previous, phase: "over", chooser: null },
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
			game: state.game + 1,
			phase: "side",
			chooser: other(config, winner),
		},
		...played,
		finished,
	);
}

export const seriesCommands = {
	"series.start": (state: SeriesState, config: SeriesConfig) => {
		if (state.phase === "over") return fail("series-over");
		if (state.config) return fail("wrong-action", { expected: "none" });
		if (config.ai?.some(Boolean) && !state.content) {
			return fail("invalid-command", { path: "ai" });
		}
		const needed = requiredPool(config.format, config.fearless);
		if (config.pool.length < needed) {
			return fail("pool-too-small", {
				needed,
				available: config.pool.length,
			});
		}
		const started: SeriesState = { ...state, config, game: 1, phase: "side" };
		const fact = {
			type: "series.started",
			teams: config.teams,
			format: config.format,
			fearless: config.fearless,
			timer: config.timer,
			pool: config.pool,
			seed: config.seed,
			...(config.ai ? { ai: config.ai } : {}),
		};
		if (config.seeds) {
			const [a, b] = config.seeds;
			const chooser = b < a ? config.teams[1] : config.teams[0];
			return done({ ...started, chooser }, fact);
		}
		const rng = createRng(deriveSeed(config.seed, SCOPES.draft, 0));
		const blue = pick(rng, config.teams);
		const game = startGame(started, config, blue, "blue", "draw");
		return done(game.state, fact, ...game.facts);
	},

	"side.choose": during<{ team: string; side: Side }>(
		"side",
		"side",
		(state, config, { team, side }) => {
			if (team !== state.chooser) return fail("not-your-turn", { team });
			const game = startGame(
				state,
				config,
				team,
				side,
				state.game === 1 ? "seed" : "choice",
			);
			return done(game.state, ...game.facts);
		},
	),

	"draft.ban": draftAction("ban"),
	"draft.pick": draftAction("pick"),
	"draft.timeout": timeout,

	"draft.roles": during<{ team: string; roles: Roles }>(
		"draft",
		"roles",
		(state, _config, { team, roles }) => {
			const next = assignRoles(state.draft as GameDraft, team, roles);
			if (!next.ok) return next;
			return done(
				{
					...state,
					draft: next.value,
					phase: turn(next.value) ? "draft" : "result",
				},
				{ type: "draft.rolesAssigned", game: state.game, team, roles },
			);
		},
	),

	"game.finish": during<{ winner: string }>(
		"result",
		"result",
		(state, config, { winner }) => {
			if (!config.teams.includes(winner)) {
				return fail("invalid-command", { path: "winner" });
			}
			return finish(state, config, winner);
		},
	),

	/** Plays the game from the draft (plan 08); its winner comes out of play. */
	"match.play": during<Record<string, never>>(
		"result",
		"result",
		(state, config) => {
			if (!state.match || !state.content) {
				return fail("invalid-command", { path: "match" });
			}
			const draft = state.draft as GameDraft;
			const { blue, red } = draft.roles as Required<typeof draft.roles>;
			const game = playGame({
				seed: config.seed,
				game: state.game,
				draft: state.content,
				match: state.match,
				blue: { team: draft.blue, roles: blue },
				red: { team: draft.red, roles: red },
			});
			return finish(state, config, game.winner, game.facts);
		},
	),
} satisfies Record<string, CommandHandler<SeriesState>>;
