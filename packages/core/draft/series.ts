import type { CoreError, Side } from "@rift-legends/contracts";
import { pick } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { CommandHandler, Emitted, Outcome } from "../server/dispatcher";
import {
	type AvailabilityInput,
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
}

export const initialSeries: SeriesState = {
	config: null,
	phase: "idle",
	game: 0,
	wins: [0, 0],
	chooser: null,
	draft: null,
	previous: [],
};

const WINS_NEEDED: Record<Format, number> = { bo1: 1, bo3: 2, bo5: 3 };

const fail = (
	code: CoreError["code"],
	params: CoreError["params"] = {},
): Outcome<SeriesState> => ({ ok: false, error: { code, params } });

const done = (
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

const draftAction = (action: "ban" | "pick") =>
	during<{ team: string; champion: string | null }>(
		"draft",
		action,
		(state, config, { team, champion }) => {
			const draft = state.draft as GameDraft;
			if (champion !== null) {
				const free = checkChampion(
					availabilityInput(config, state),
					team,
					action,
					champion,
				);
				if (!free.ok) return { ok: false, error: free.error };
			}
			const next = act(draft, team, action, champion);
			if (!next.ok) return next;
			return done(
				{ ...state, draft: next.value },
				{
					type: action === "ban" ? "draft.banned" : "draft.picked",
					game: state.game,
					team,
					champion,
					timeout: false,
				},
			);
		},
	);

export const seriesCommands = {
	"series.start": (state: SeriesState, config: SeriesConfig) => {
		if (state.phase === "over") return fail("series-over");
		if (state.config) return fail("wrong-action", { expected: "none" });
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
			const index = config.teams.indexOf(winner);
			if (index < 0) return fail("invalid-command", { path: "winner" });
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
				finished,
			);
		},
	),
} satisfies Record<string, CommandHandler<SeriesState>>;
