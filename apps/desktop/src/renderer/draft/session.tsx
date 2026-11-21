import {
	CONTRACT_VERSION,
	type DraftView,
	type SeriesOptions,
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
import {
	CoreErrorMessage,
	CoreRequestError,
	sessionLost,
	useCoreCommand,
	useCoreQuery,
	useOpenSession,
} from "../core";

/**
 * Presentation-only stages that the core does not know about (plan 09, "Flujo").
 * - `side`: the side the AI took, shown until the user continues.
 * - `match`: the game being replayed (the core has already played it).
 * - `result`: the finished game's result, shown until the user continues.
 */
export type Presentation = "side" | "match" | "result";

interface DraftSession {
	sessionId: number;
	/** Teams (name and coach) and the champion pool the session offers. */
	options: SeriesOptions;
	/** `null` until a series starts. */
	view: DraftView | null;
	/** The team the user plays; set by the setup screen when the series starts. */
	mine: string | null;
	setMine(team: string): void;
	/** Sends a command at the session's next position; false if the core rejected it. */
	send(kind: string, payload: unknown): Promise<boolean>;
	presentation: Presentation | null;
	/** Shows a presentation stage over the core's phase; `null` goes back to it. */
	present(stage: Presentation | null): void;
}

const Context = createContext<DraftSession | null>(null);

/** The state of the quick-draft flow, for every sub-screen. */
export function useDraftSession() {
	const session = use(Context);
	if (!session) throw new Error("useDraftSession needs a DraftSessionProvider");
	return session;
}

export const teamName = (options: SeriesOptions, id: string) =>
	options.teams.find((team) => team.id === id)?.name ?? id;

const everyFact = () => true;
const noFact = () => false;

function LoadedSession(props: {
	sessionId: number;
	onLost: () => void;
	children: ReactNode;
}) {
	const { sessionId, onLost } = props;
	const { mutateAsync } = useCoreCommand();
	const position = useRef(0);
	const [error, setError] = useState<CoreRequestError | null>(null);
	const [mine, setMine] = useState<string | null>(null);
	const [presentation, present] = useState<Presentation | null>(null);

	const view = useCoreQuery<DraftView | null>(
		{ v: CONTRACT_VERSION, kind: "draft.view", sessionId, params: {} },
		{ affectedBy: everyFact },
	);
	const options = useCoreQuery<SeriesOptions>(
		{ v: CONTRACT_VERSION, kind: "series.options", sessionId, params: {} },
		{ affectedBy: noFact },
	);

	const send = useCallback(
		async (kind: string, payload: unknown) => {
			try {
				const result = await mutateAsync({
					v: CONTRACT_VERSION,
					kind,
					sessionId,
					expectedPosition: position.current,
					payload,
				});
				position.current = result.position;
				setError(null);
				return true;
			} catch (caught) {
				if (!(caught instanceof CoreRequestError)) throw caught;
				setError(caught);
				if (sessionLost(caught)) onLost();
				return false;
			}
		},
		[mutateAsync, sessionId, onLost],
	);

	const value = useMemo(
		() =>
			options.data && view.data !== undefined
				? {
						sessionId,
						options: options.data,
						view: view.data,
						mine,
						setMine,
						send,
						presentation,
						present,
					}
				: null,
		[sessionId, options.data, view.data, mine, send, presentation],
	);

	const failure = options.error ?? view.error ?? error;
	return (
		<>
			{value && <Context value={value}>{props.children}</Context>}
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
		<LoadedSession key={sessionId} sessionId={sessionId} onLost={onLost}>
			{children}
		</LoadedSession>
	);
}
