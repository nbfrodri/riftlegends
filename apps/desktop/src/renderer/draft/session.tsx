import {
	CONTRACT_VERSION,
	type ContentSet,
	type DraftView,
	type SeriesOptions,
	type TeamStrategy,
} from "@rift-legends/contracts";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../shared/bridge";
import { useOptionalAssets } from "../assets";
import { appContent } from "../content-set";
import {
	CoreErrorMessage,
	CoreRequestError,
	sessionLost,
	useCoreCommand,
	useCoreQuery,
	useOpenSession,
} from "../core";
import { localizeChampions } from "./real-content";
import {
	type DraftLock,
	type SeriesRules,
	useSeriesFacts,
} from "./session-facts";

/**
 * Presentation-only stages that the core does not know about (plan 09, "Flujo").
 * - `side`: the two confirmed choices, until the user continues.
 * - `match`: the game being replayed (the core has already played it).
 * - `result`: the finished game's result, shown until the user continues.
 */
export type Presentation = "side" | "match" | "result";

/** The user's series of a season (plan 31, U10): where it lives and how it is left. */
interface InSeason {
	/** The breadcrumb root, in place of «Draft rápido». */
	readonly crumb: string;
	/** The result screen's way out, in place of a new series. */
	readonly exit: string;
	onExit(): void;
}

interface DraftSession {
	timer: boolean;
	/** `null` until a series starts. */
	rules: SeriesRules | null;
	/** The team that actively chose a side, keyed by game. */
	sideChoosers: Readonly<Record<number, string>>;
	lock: DraftLock | null;
	sessionId: number;
	/** The content set the setup offers and the series is played with. */
	content: ContentSet;
	/**
	 * Teams (name and coach) and the champion pool of `content`; with real
	 * content, champions carry their cached name in the UI language (R4).
	 */
	options: SeriesOptions;
	/** `null` until a series starts. */
	view: DraftView | null;
	/** The team the user plays; set by the setup screen when the series starts. */
	mine: string | null;
	setMine(team: string): void;
	/** False if the turn was already claimed or the core rejected the command. */
	send(kind: string, payload: unknown): Promise<boolean>;
	/** The plan chosen on the plan screen, which the match screen sends with `match.play`. */
	strategy: TeamStrategy | null;
	setStrategy(strategy: TeamStrategy | null): void;
	presentation: Presentation | null;
	/** Shows a presentation stage over the core's phase; `null` goes back to it. */
	present(stage: Presentation | null): void;
	/** Throws the series away and starts over at the setup, with a fresh session. */
	restart(): void;
	/** Set when the series belongs to a season; `null` in the quick draft. */
	inSeason: InSeason | null;
}

const Context = createContext<DraftSession | null>(null);
// Apart from the session: its value changes with every fact, and a reader of
// only the content set (every champion portrait) must not re-render for that.
const ContentContext = createContext<ContentSet | null>(null);
// Teams and champions of a series: the draft flow and a read-only season
// series both offer them to the result screens.
const OptionsContext = createContext<SeriesOptions | null>(null);

/** The state of the quick-draft flow, for every sub-screen. */
export function useDraftSession() {
	const session = use(Context);
	if (!session) throw new Error("useDraftSession needs a DraftSessionProvider");
	return session;
}

/** Teams (name, coach and players) and champions of the series on screen. */
export function useSeriesOptions(): SeriesOptions {
	const options = use(OptionsContext);
	if (!options) throw new Error("useSeriesOptions needs a series provider");
	return options;
}

/** The session's content set; fictional outside a session (e.g. a lone board column). */
export function useDraftContent(): ContentSet {
	return use(ContentContext) ?? "fictional";
}

export const teamName = (options: SeriesOptions, id: string) =>
	options.teams.find((team) => team.id === id)?.name ?? id;

export const playerProfile = (options: SeriesOptions, id: string) =>
	options.teams
		.flatMap((team) => team.players)
		.find((player) => player.id === id);

export const championLabel = (options: SeriesOptions, id: string) =>
	options.champions.find((champion) => champion.id === id)?.name ?? id;

const everyFact = () => true;
const noFact = () => false;

/** `series.options` of `content`; with real content, champions carry their cached name in the UI language (R4). */
function useShownOptions(sessionId: number, content: ContentSet) {
	const { i18n } = useTranslation();
	const catalog = useOptionalAssets()?.champions;
	const options = useCoreQuery<SeriesOptions>(
		{
			v: CONTRACT_VERSION,
			kind: "series.options",
			sessionId,
			params: { content },
		},
		{ affectedBy: noFact },
	);
	const shown = useMemo(
		() =>
			options.data && content === "real"
				? localizeChampions(options.data, catalog, i18n.language)
				: options.data,
		[options.data, content, catalog, i18n.language],
	);
	return { options, shown };
}

interface SeasonSeries {
	/** The season's position: the series' commands follow its facts. */
	readonly position: { current: number };
	/** The facts of the series so far, from `series.started` on. */
	readonly facts: readonly CoreFact[];
	readonly mine: string;
	readonly inSeason: InSeason;
	/** Each batch of facts the series' commands return. */
	onFacts(facts: readonly CoreFact[]): void;
}

function LoadedSession(props: {
	sessionId: number;
	content: ContentSet;
	onLost: () => void;
	season?: SeasonSeries;
	children: ReactNode;
}) {
	const { sessionId, onLost, content, season } = props;
	const { mutateAsync } = useCoreCommand();
	const own = useRef(0);
	const position = season?.position ?? own;
	const { timer, rules, sideChoosers, lock, applyFacts } = useSeriesFacts();
	const claimedTurn = useRef<DraftView | null>(null);
	const [error, setError] = useState<CoreRequestError | null>(null);
	const [mine, setMine] = useState<string | null>(season?.mine ?? null);
	const resumed = useRef(season?.facts);
	useEffect(() => {
		if (resumed.current) applyFacts(resumed.current);
	}, [applyFacts]);
	const onFacts = season?.onFacts;
	const inSeason = season?.inSeason ?? null;
	const [presentation, present] = useState<Presentation | null>(null);
	const [strategy, setStrategy] = useState<TeamStrategy | null>(null);

	const view = useCoreQuery<DraftView | null>(
		{ v: CONTRACT_VERSION, kind: "draft.view", sessionId, params: {} },
		{ affectedBy: everyFact },
	);
	const { options, shown } = useShownOptions(sessionId, content);

	const send = useCallback(
		async (kind: string, payload: unknown) => {
			// A click and its deadline can race before the refreshed view arrives.
			const turn = view.data?.turn ? view.data : null;
			if (turn && claimedTurn.current === turn) return false;
			if (turn) claimedTurn.current = turn;
			try {
				const result = await mutateAsync({
					v: CONTRACT_VERSION,
					kind,
					sessionId,
					expectedPosition: position.current,
					payload,
				});
				position.current = result.position;
				applyFacts(result.facts);
				onFacts?.(result.facts);
				setError(null);
				return true;
			} catch (caught) {
				if (claimedTurn.current === turn) claimedTurn.current = null;
				if (!(caught instanceof CoreRequestError)) throw caught;
				setError(caught);
				if (sessionLost(caught)) onLost();
				return false;
			}
		},
		[mutateAsync, sessionId, onLost, view.data, applyFacts, position, onFacts],
	);

	const value = useMemo(
		() =>
			shown && view.data !== undefined
				? {
						sessionId,
						content,
						options: shown,
						timer,
						rules,
						sideChoosers,
						lock,
						view: view.data,
						mine,
						setMine,
						strategy,
						setStrategy,
						send,
						presentation,
						present,
						restart: onLost,
						inSeason,
					}
				: null,
		[
			sessionId,
			content,
			shown,
			view.data,
			mine,
			strategy,
			send,
			presentation,
			onLost,
			timer,
			rules,
			sideChoosers,
			lock,
			inSeason,
		],
	);

	const failure = options.error ?? view.error ?? error;
	return (
		<>
			{value && (
				<ContentContext value={content}>
					<OptionsContext value={value.options}>
						<Context value={value}>{props.children}</Context>
					</OptionsContext>
				</ContentContext>
			)}
			{failure && <CoreErrorMessage error={failure} />}
		</>
	);
}

/**
 * Opens a core session for the quick-draft flow and offers it to the
 * sub-screens. The session lives while the draft screen is mounted; if the core
 * loses it, a fresh one is opened and the flow starts over at the setup.
 */
export function DraftSessionProvider({ children }: { children: ReactNode }) {
	const openSession = useOpenSession();
	const [sessionId, setSessionId] = useState<number | null>(null);
	const [failure, setFailure] = useState<CoreRequestError | null>(null);
	const [reopen, setReopen] = useState(0);
	const content = appContent();

	useEffect(() => {
		let live = true;
		void reopen;
		openSession().then(
			(id) => live && setSessionId(id),
			(caught) => live && setFailure(caught as CoreRequestError),
		);
		return () => {
			live = false;
		};
	}, [openSession, reopen]);

	const onLost = useCallback(() => {
		setSessionId(null);
		setReopen((count) => count + 1);
	}, []);

	if (failure) return <CoreErrorMessage error={failure} />;
	if (sessionId === null) return null;
	return (
		<LoadedSession
			key={sessionId}
			sessionId={sessionId}
			content={content}
			onLost={onLost}
		>
			{children}
		</LoadedSession>
	);
}

/**
 * Content set and series options for the result screens outside the draft
 * flow: a series of the season, read-only (plan 31, U5), on `sessionId`.
 */
export function SeriesContentProvider({
	sessionId,
	children,
}: {
	sessionId: number;
	children: ReactNode;
}) {
	const content = appContent();
	const { options, shown } = useShownOptions(sessionId, content);
	if (options.error) return <CoreErrorMessage error={options.error} />;
	if (!shown) return null;
	return (
		<ContentContext value={content}>
			<OptionsContext value={shown}>{children}</OptionsContext>
		</ContentContext>
	);
}

/**
 * The draft flow on the user's series of a season (plan 31, U10): the series
 * was started with `season.playSeries`, so its commands and views go to the
 * season, and the result screen leaves it with `inSeason.onExit`.
 */
export function SeasonSeriesProvider({
	sessionId,
	onLost,
	children,
	...season
}: SeasonSeries & {
	sessionId: number;
	onLost: () => void;
	children: ReactNode;
}) {
	return (
		<LoadedSession
			sessionId={sessionId}
			content={appContent()}
			onLost={onLost}
			season={season}
		>
			{children}
		</LoadedSession>
	);
}
