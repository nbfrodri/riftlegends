import {
	CONTRACT_VERSION,
	type MatchView,
	type SeriesSummary,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { RotateCcw } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	CoreErrorMessage,
	type CoreRequestError,
	useCoreQueries,
	useCoreQuery,
} from "../core";
import { type GameResult, readGame } from "./result-data";
import { GameReport, Victory } from "./result-game";
import { SeriesBanner, SeriesReport } from "./result-series";
import { teamName, useDraftSession, useSeriesOptions } from "./session";

const SERIES = "series";
type TabId = typeof SERIES | number;

const isGameFinished = (fact: { type: string }) =>
	fact.type === "game.finished";

function Tabs(props: {
	games: readonly GameResult[];
	selected: TabId;
	onSelect: (tab: TabId) => void;
}) {
	const { t } = useTranslation();
	const refs = useRef(new Map<TabId, HTMLButtonElement>());
	const tabs: TabId[] = [SERIES, ...props.games.map((g) => g.game)];

	const move = (event: KeyboardEvent, index: number) => {
		const next = {
			ArrowRight: (index + 1) % tabs.length,
			ArrowLeft: (index + tabs.length - 1) % tabs.length,
			Home: 0,
			End: tabs.length - 1,
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		const tab = tabs[next] as TabId;
		props.onSelect(tab);
		refs.current.get(tab)?.focus();
	};

	return (
		<div
			role="tablist"
			aria-label={t("draft.result.tabs.name")}
			className="flex gap-1 border-line border-b pb-1"
		>
			{tabs.map((tab, index) => (
				<button
					key={tab}
					ref={(node) => {
						if (node) refs.current.set(tab, node);
						else refs.current.delete(tab);
					}}
					type="button"
					role="tab"
					id={`result-tab-${tab}`}
					aria-controls="result-panel"
					aria-selected={props.selected === tab}
					tabIndex={props.selected === tab ? 0 : -1}
					onClick={() => props.onSelect(tab)}
					onKeyDown={(event) => move(event, index)}
					className="press cursor-pointer rounded-control border border-transparent px-4 py-1.5 text-muted outline-offset-2 hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-action aria-selected:border-action aria-selected:bg-action/15 aria-selected:font-bold aria-selected:text-text"
				>
					{tab === SERIES
						? t("draft.result.tabs.series")
						: t("draft.result.tabs.map", { game: tab })}
				</button>
			))}
		</div>
	);
}

/** A finished series: its banner, then a tab for the whole series and one per map. */
export function SeriesResult(props: {
	games: readonly GameResult[];
	summary: SeriesSummary | undefined;
	/** Offered in the banner, next to the score. */
	action?: ReactNode;
}) {
	const [selected, setSelected] = useState<TabId>(SERIES);
	if (props.games.length === 0) return null;

	const game = typeof selected === "number" ? props.games[selected - 1] : null;

	return (
		<>
			<SeriesBanner games={props.games} action={props.action} />
			<div className="grid min-w-0 gap-2">
				<Tabs games={props.games} selected={selected} onSelect={setSelected} />
				<section
					role="tabpanel"
					id="result-panel"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabs pattern, the panel is the next stop after the tabs
					tabIndex={0}
					aria-labelledby={`result-tab-${selected}`}
					className="min-w-0"
				>
					{game ? (
						<GameReport game={game} summary={props.summary} showWinner />
					) : (
						<SeriesReport
							games={props.games}
							summary={props.summary}
							onOpen={setSelected}
						/>
					)}
				</section>
			</div>
		</>
	);
}

function GameResultScreen(props: {
	game: GameResult;
	summary: SeriesSummary | undefined;
}) {
	const { t } = useTranslation();
	const { present } = useDraftSession();
	const options = useSeriesOptions();
	const { game } = props;
	return (
		<>
			<Victory
				label={t("draft.result.game.winner", { game: game.game })}
				title={t("draft.result.victory", {
					team: teamName(options, game.winner),
				})}
				side={game.winner === game.blue ? "blue" : "red"}
			>
				<Button onClick={() => present(null)}>
					{t("draft.result.nextGame")}
				</Button>
			</Victory>
			<GameReport game={game} summary={props.summary} showWinner={false} />
		</>
	);
}

function LoadedResult(props: { played: number; over: boolean }) {
	const { t } = useTranslation();
	const { sessionId, restart, inSeason } = useDraftSession();
	const queries = useCoreQueries<MatchView>(
		Array.from({ length: props.played }, (_, i) => ({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId,
			params: { game: i + 1 },
		})),
	);
	const summary = useCoreQuery<SeriesSummary>(
		{ v: CONTRACT_VERSION, kind: "series.summary", sessionId, params: {} },
		{ affectedBy: isGameFinished },
	);

	const games = queries.map((q) => (q.data ? readGame(q.data) : null));
	const failure = (queries.find((q) => q.error)?.error ??
		summary.error) as CoreRequestError | null;
	if (failure) return <CoreErrorMessage error={failure} />;
	if (games.some((game) => !game)) return null;
	const played = games as GameResult[];
	const last = played.at(-1);
	if (!last) return null;
	return props.over ? (
		<SeriesResult
			games={played}
			summary={summary.data}
			action={
				inSeason ? (
					<Button onClick={inSeason.onExit}>{inSeason.exit}</Button>
				) : (
					<Button onClick={restart}>
						{t("draft.result.newSeries")}
						<RotateCcw aria-hidden="true" className="size-4" />
					</Button>
				)
			}
		/>
	) : (
		<GameResultScreen game={last} summary={summary.data} />
	);
}

/**
 * U9 and U10: the result of the game just played, and, once the series is
 * over, the whole series with a tab per map. Everything comes from
 * `match.view` and `series.summary`; nothing is simulated here.
 */
export function ResultScreen() {
	const { view } = useDraftSession();
	if (!view) return null;
	// After a game that does not end the series the core already points at the next one.
	const over = view.phase === "over";
	const played = over ? view.game : view.game - 1;
	if (played < 1) return null;
	return <LoadedResult key={view.game} played={played} over={over} />;
}
