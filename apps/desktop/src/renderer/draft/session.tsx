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
import { useOptionalAssets } from "../assets";
import {
	CoreErrorMessage,
	CoreRequestError,
	sessionLost,
	useCoreCommand,
	useCoreQuery,
	useOpenSession,
} from "../core";
import { localizeChampions } from "./real-content";

/**
 * Presentation-only stages that the core does not know about (plan 09, "Flujo").
 * - `side`: the two confirmed choices, until the user continues.
 * - `match`: the game being replayed (the core has already played it).
 * - `result`: the finished game's result, shown until the user continues.
 */
export type Presentation = "side" | "match" | "result";

/** Format and fearless mode of the series, from its `series.started` fact. */
export interface SeriesRules {
	format: "bo1" | "bo3" | "bo5";
	fearless: "hard" | "soft" | "off";
}

interface DraftSession {
	timer: boolean;
	/** `null` until a series starts. */
	rules: SeriesRules | null;
	/** The team that actively chose a side, keyed by game. */
	sideChoosers: Readonly<Record<number, string>>;
	lock: {
		game: number;
		position: number;
		team: string;
		champion: string | null;
		action: "ban" | "pick";
	} | null;
	sessionId: number;
	/** The content set the setup offers and the series is played with. */
	content: ContentSet;
	/** Only before the series starts: the setup's content choice (A1). */
	setContent(content: ContentSet): void;
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
}

const Context = createContext<DraftSession | null>(null);
// Apart from the session: its value changes with every fact, and a reader of
// only the content set (every champion portrait) must not re-render for that.
const ContentContext = createContext<ContentSet | null>(null);

/** The state of the quick-draft flow, for every sub-screen. */
export function useDraftSession() {
	const session = use(Context);
	if (!session) throw new Error("useDraftSession needs a DraftSessionProvider");
	return session;
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

function LoadedSession(props: {
	sessionId: number;
	content: ContentSet;
	setContent(content: ContentSet): void;
	onLost: () => void;
	children: ReactNode;
}) {
	const { sessionId, onLost, content, setContent } = props;
	const { i18n } = useTranslation();
	const catalog = useOptionalAssets()?.champions;
	const { mutateAsync } = useCoreCommand();
	const position = useRef(0);
	const [timer, setTimer] = useState(false);
	const [rules, setRules] = useState<SeriesRules | null>(null);
	const [sideChoosers, setSideChoosers] = useState<Record<number, string>>({});
	const [lock, setLock] = useState<DraftSession["lock"]>(null);
	const claimedTurn = useRef<DraftView | null>(null);
	const [error, setError] = useState<CoreRequestError | null>(null);
	const [mine, setMine] = useState<string | null>(null);
	const [presentation, present] = useState<Presentation | null>(null);
	const [strategy, setStrategy] = useState<TeamStrategy | null>(null);

	const view = useCoreQuery<DraftView | null>(
		{ v: CONTRACT_VERSION, kind: "draft.view", sessionId, params: {} },
		{ affectedBy: everyFact },
	);
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
				for (const fact of result.facts) {
					if (
						fact.type === "side.chosen" &&
						fact.kind === "side" &&
						typeof fact.game === "number" &&
						typeof fact.team === "string"
					) {
						const { game, team } = fact;
						setSideChoosers((previous) => ({ ...previous, [game]: team }));
					}
					if (fact.type === "series.started") {
						setTimer(fact.timer === true);
						setRules({
							format: fact.format as SeriesRules["format"],
							fearless: fact.fearless as SeriesRules["fearless"],
						});
					}
					if (
						(fact.type === "draft.banned" || fact.type === "draft.picked") &&
						typeof fact.game === "number" &&
						typeof fact.team === "string" &&
						(typeof fact.champion === "string" || fact.champion === null)
					) {
						setLock({
							game: fact.game,
							position: fact.position,
							team: fact.team,
							champion: fact.champion,
							action: fact.type === "draft.banned" ? "ban" : "pick",
						});
					}
				}
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
		[mutateAsync, sessionId, onLost, view.data],
	);

	const value = useMemo(
		() =>
			shown && view.data !== undefined
				? {
						sessionId,
						content,
						setContent,
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
					}
				: null,
		[
			sessionId,
			content,
			setContent,
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
		],
	);

	const failure = options.error ?? view.error ?? error;
	return (
		<>
			{value && (
				<ContentContext value={content}>
					<Context value={value}>{props.children}</Context>
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
export function DraftSessionProvider({
	children,
	initialContent = "fictional",
}: {
	children: ReactNode;
	initialContent?: ContentSet;
}) {
	const openSession = useOpenSession();
	const [sessionId, setSessionId] = useState<number | null>(null);
	const [failure, setFailure] = useState<CoreRequestError | null>(null);
	const [reopen, setReopen] = useState(0);
	const [content, setContent] = useState<ContentSet>(initialContent);

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
			setContent={setContent}
			onLost={onLost}
		>
			{children}
		</LoadedSession>
	);
}
