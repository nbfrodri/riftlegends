import {
	CONTRACT_VERSION,
	type MatchView,
	type SeriesSummary,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	CoreErrorMessage,
	type CoreRequestError,
	useCoreQueries,
	useCoreQuery,
} from "../core";
import { type GameResult, readGame } from "../draft/result-data";
import { SeriesResult } from "../draft/result-screen";
import {
	SeriesContentProvider,
	teamName,
	useSeriesOptions,
} from "../draft/session";
import { TeamCrest } from "../draft/team-crest";
import { competitionName, dayDate, stageName } from "./names";
import type { ScheduleSlot } from "./schedule-view";
import { useExhibitionSeason, useSeasonOverview } from "./season";

// `/competicion/serie/$series` (plan 31, U5): a played series of the season,
// read-only, with the result screens of the quick draft. The core plays it
// again from its seed to answer `series.summary` and `match.view`.

const page =
	"flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] overflow-y-auto px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]";

const never = () => false;

export function SeriesScreen({ series }: { series: string }) {
	const season = useExhibitionSeason();
	return (
		<section className={page}>
			{season.error && <CoreErrorMessage error={season.error} />}
			{season.data && (
				<SeriesContentProvider sessionId={season.data.sessionId}>
					<LoadedSeries sessionId={season.data.sessionId} series={series} />
				</SeriesContentProvider>
			)}
		</section>
	);
}

function LoadedSeries({
	sessionId,
	series,
}: {
	sessionId: number;
	series: string;
}) {
	const summary = useCoreQuery<SeriesSummary>(
		{
			v: CONTRACT_VERSION,
			kind: "series.summary",
			sessionId,
			params: { series },
		},
		{ affectedBy: never },
	);
	const played = summary.data?.lanes.length ?? 0;
	const queries = useCoreQueries<MatchView>(
		Array.from({ length: played }, (_, i) => ({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId,
			params: { series, game: i + 1 },
		})),
	);
	const failure = (summary.error ??
		queries.find((q) => q.error)?.error) as CoreRequestError | null;
	if (failure)
		return (
			<>
				<Header sessionId={sessionId} series={series} games={[]} />
				<CoreErrorMessage error={failure} />
			</>
		);
	const games = queries.map((q) => (q.data ? readGame(q.data) : null));
	if (!summary.data || games.some((game) => !game)) return null;
	const loaded = games as GameResult[];
	return (
		<>
			<Header sessionId={sessionId} series={series} games={loaded} />
			<SeriesResult games={loaded} summary={summary.data} />
		</>
	);
}

/** The two teams, where and when they played, and the way back. */
function Header({
	sessionId,
	series,
	games,
}: {
	sessionId: number;
	series: string;
	games: readonly GameResult[];
}) {
	const { t, i18n } = useTranslation();
	const options = useSeriesOptions();
	const router = useRouter();
	const navigate = useNavigate();
	const canGoBack = useCanGoBack();
	const overview = useSeasonOverview(sessionId);
	const schedule = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: {},
		},
		{ affectedBy: never },
	);
	const slot = schedule.data?.find(({ id }) => id === series);
	const first = games[0];
	const year = overview.data?.year;
	return (
		<header className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex min-w-0 items-center gap-3">
					{first && (
						<TeamLink id={first.blue} name={teamName(options, first.blue)} />
					)}
					<h1 className="min-w-0 truncate font-bold font-display text-[clamp(24px,2.1vw,40px)] uppercase leading-none tracking-heading">
						{first
							? t("competition.series.title", {
									a: teamName(options, first.blue),
									b: teamName(options, first.red),
								})
							: t("competition.series.unknown")}
					</h1>
					{first && (
						<TeamLink id={first.red} name={teamName(options, first.red)} />
					)}
				</div>
				{slot && year !== undefined && (
					<p className="mt-1 text-muted">
						{t("competition.series.where", {
							competition: competitionName(t, slot.competition),
							stage: stageName(slot.stage),
							date: dayDate(year, slot.day, i18n.language),
						})}
					</p>
				)}
			</div>
			<Button
				variant="secondary"
				onClick={() =>
					canGoBack
						? router.history.back()
						: void navigate({ to: "/competicion" })
				}
			>
				{t("competition.series.back")}
			</Button>
		</header>
	);
}

/** A team's crest, opening its page (U8). */
function TeamLink({ id, name }: { id: string; name: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	return (
		<button
			type="button"
			aria-label={t("competition.open", { name })}
			onClick={() =>
				void navigate({ to: "/competicion/equipo/$team", params: { team: id } })
			}
			className="press shrink-0 cursor-pointer rounded-control p-0.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action"
		>
			<TeamCrest
				id={id}
				name={name}
				className="h-[clamp(28px,2.6vw,44px)] w-[clamp(36px,3.4vw,58px)]"
			/>
		</button>
	);
}
