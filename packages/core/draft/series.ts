import type {
	AiContent,
	AiOfTeam,
	ContentSet,
	MapSnapshot,
	MatchContent,
	SideChoice,
	TeamStrategy,
} from "@rift-legends/contracts";
import type { Contest } from "../match/profile";
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
import { act, assignRoles, type GameDraft, type Roles, turn } from "./game";
import { done, fail } from "./outcome";
import { playResult } from "./result";
import { type Choice, chooseSide, drawPriority } from "./sides";

export interface SeriesConfig {
	readonly teams: readonly [string, string];
	readonly format: Format;
	readonly fearless: Fearless;
	readonly timer: boolean;
	readonly pool: readonly string[];
	readonly seed: number;
	/** Which teams the AI plays, in `teams` order (plan 07). */
	readonly ai?: readonly [AiOfTeam, AiOfTeam];
	/** Content the series is played with; the session's own when absent. */
	readonly content?: ContentSet;
}

/** A content set: what the draft AI and the match simulation read. */
export interface LoadedContent {
	readonly season?: number;
	readonly content: AiContent;
	readonly match: MatchContent;
}

/** The content sets a session can play, loaded on first use. */
export type ContentLibrary = Readonly<
	Partial<Record<ContentSet, () => LoadedContent>>
>;

export interface SeriesState {
	readonly config: SeriesConfig | null;
	readonly phase: "idle" | "side" | "draft" | "result" | "over";
	/** Number of the current (or next) game, from 1. */
	readonly game: number;
	/** Wins in the order of `config.teams`. */
	readonly wins: readonly [number, number];
	/** Team that must make a side choice before the next game. */
	readonly chooser: string | null;
	/** The side choices of the current game, priority first (issue #305). */
	readonly choices: readonly Choice[];
	readonly draft: GameDraft | null;
	/** Picks of each finished game, by team. */
	readonly previous: readonly Readonly<Record<string, readonly string[]>>[];
	/** What the draft AI reads; loaded with the session, not sent in commands. */
	readonly content: AiContent | null;
	/** What the match simulation reads (plan 08); loaded the same way. */
	readonly match: MatchContent | null;
	/** The sets `series.start` and `series.options` can name (plan 11). */
	readonly library: ContentLibrary;
	/** Each finished game: its winner and where it won the most (F8, F12). */
	readonly outcomes: readonly {
		readonly winner: string;
		readonly edge: Contest | null;
	}[];
	/** The `match.*` facts of each finished game, for `match.view` (plan 09, Q3). */
	readonly matches: readonly (readonly Emitted[])[];
	/** The map of each finished game minute by minute, for `match.view` (Q4). */
	readonly maps: readonly (readonly MapSnapshot[])[];
}

export { done, fail, WINS_NEEDED } from "./outcome";
export { finishGame } from "./result";

export const initialSeries: SeriesState = {
	config: null,
	phase: "idle",
	game: 0,
	wins: [0, 0],
	chooser: null,
	choices: [],
	draft: null,
	previous: [],
	content: null,
	match: null,
	library: {},
	outcomes: [],
	matches: [],
	maps: [],
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

export const seriesCommands = {
	"series.start": (current: SeriesState, config: SeriesConfig) => {
		if (current.phase === "over") return fail("series-over");
		if (current.config) return fail("wrong-action", { expected: "none" });
		let state = current;
		if (config.content) {
			const set = current.library[config.content]?.();
			if (!set) return fail("invalid-command", { path: "content" });
			state = { ...current, content: set.content, match: set.match };
		}
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
		const started: SeriesState = {
			...state,
			config,
			game: 1,
			phase: "side",
			chooser: drawPriority(config),
			choices: [],
		};
		const fact = {
			type: "series.started",
			teams: config.teams,
			format: config.format,
			fearless: config.fearless,
			timer: config.timer,
			pool: config.pool,
			seed: config.seed,
			...(config.ai ? { ai: config.ai } : {}),
			...(config.content ? { content: config.content } : {}),
		};
		return done(started, fact);
	},

	"side.choose": during<{ team: string; choice: SideChoice }>(
		"side",
		"side",
		chooseSide,
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

	/** Plays the game from the draft (plan 08); its winner comes out of play. */
	"match.play": during<{ strategy?: TeamStrategy }>(
		"result",
		"result",
		playResult,
	),
} satisfies Record<string, CommandHandler<SeriesState>>;
