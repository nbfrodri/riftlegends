import { Button } from "@rift-legends/ui-kit/components/button";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CoreErrorMessage } from "../core";
import {
	type AdvanceMode,
	type AdvanceRun,
	stageTarget,
	useSeasonAdvance,
} from "./advance";
import { CompetitionCard } from "./competition-card";
import { competitionName, dayDate, isInternational, stageName } from "./names";
import {
	type SeasonHandle,
	useExhibitionSeason,
	useSeasonOverview,
	useSeasonSchedule,
	useTeamNames,
} from "./season";

// The `/competicion` route (plan 31, U1 and U2): one card per competition of
// the exhibition season and the controls that play it.

const page =
	"flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]";

export function CompetitionScreen() {
	const { t } = useTranslation();
	const season = useExhibitionSeason();
	return (
		<section className={page}>
			{season.data ? (
				<Season
					key={season.data.sessionId}
					season={season.data}
					onRestart={season.restart}
				/>
			) : (
				<>
					<Heading />
					{season.error ? (
						<CoreErrorMessage error={season.error} />
					) : (
						<p role="status" className="text-muted">
							{t("competition.creating")}
						</p>
					)}
				</>
			)}
		</section>
	);
}

function Heading({ children }: { children?: React.ReactNode }) {
	const { t } = useTranslation();
	return (
		<div className="min-w-0">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{t("shell.nav.competition")}
			</h1>
			{children}
		</div>
	);
}

function Season({
	season,
	onRestart,
	onPlayMySeries,
}: {
	season: SeasonHandle;
	onRestart: () => void;
	/** Opens the user's series (plan 31, U10); not wired before careers exist. */
	onPlayMySeries?: (series: string) => void;
}) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const listId = useId();
	const overview = useSeasonOverview(season.sessionId);
	const { run, pending, error, start, stop } = useSeasonAdvance(season);
	const schedule = useSeasonSchedule(season.sessionId);
	const teamName = useTeamNames(season.sessionId);
	const view = overview.data;
	if (!view) {
		return (
			<>
				<Heading />
				{overview.error && <CoreErrorMessage error={overview.error} />}
			</>
		);
	}

	const over = view.day === null;
	const busy = run !== null || pending !== null || over;
	const target = stageTarget(view);
	const play = (mode: AdvanceMode) => () => void start(mode);
	const leagues = view.competitions.filter(({ id }) => !isInternational(id));
	const events = view.competitions.filter(({ id }) => isInternational(id));
	const groups = (
		leagues.length && events.length
			? [
					{ key: "leagues", competitions: leagues },
					{ key: "international", competitions: events },
				]
			: [{ key: "all", competitions: view.competitions }]
	) as {
		key: "leagues" | "international" | "all";
		competitions: typeof leagues;
	}[];

	return (
		<>
			<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<Heading>
					<p className="mt-2 flex flex-wrap gap-x-5 text-[14px] tabular-nums">
						<span className="text-muted">
							{t("competition.season", { year: view.year })}
						</span>
						{view.day === null ? (
							<b className="font-semibold">{t("competition.over")}</b>
						) : (
							<span className="font-semibold">
								{t("competition.today", {
									day: view.day,
									date: dayDate(view.year, view.day, i18n.language),
								})}
							</span>
						)}
					</p>
				</Heading>
				<fieldset
					aria-label={t("competition.advance.label")}
					className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
				>
					{pending && (
						<>
							<span className="text-[14px]">
								{t("competition.advance.pending", {
									a: teamName(pending.teams[0]),
									b: teamName(pending.teams[1]),
								})}
							</span>
							<Button
								disabled={!onPlayMySeries}
								onClick={() => onPlayMySeries?.(pending.series)}
							>
								{t("competition.advance.mySeries")}
							</Button>
						</>
					)}
					{run && (
						<Button variant="secondary" onClick={stop}>
							{t("competition.advance.stop")}
						</Button>
					)}
					<Button
						variant={pending ? "secondary" : "default"}
						disabled={busy}
						onClick={play("day")}
					>
						{t("competition.advance.day")}
					</Button>
					<Tooltip
						disabled={busy || !target}
						content={
							target
								? t("competition.advance.stageHint", {
										competition: competitionName(t, target.competition),
										stage: stageName(target.stage),
									})
								: ""
						}
					>
						<Button variant="secondary" disabled={busy} onClick={play("stage")}>
							{t("competition.advance.stage")}
						</Button>
					</Tooltip>
					<Button variant="secondary" disabled={busy} onClick={play("season")}>
						{t("competition.advance.season")}
					</Button>
					{over && (
						<Button variant="secondary" onClick={onRestart}>
							{t("competition.newSeason")}
						</Button>
					)}
				</fieldset>
			</header>
			{run && <RunProgress run={run} year={view.year} />}
			{error && <CoreErrorMessage error={error} />}
			<div className="flex min-h-0 flex-1 flex-col gap-[clamp(14px,2.2vh,26px)] overflow-y-auto scroll-edge">
				{groups.map(({ key, competitions }) => (
					<section key={key} aria-labelledby={`${listId}-${key}`}>
						<h2
							id={`${listId}-${key}`}
							className={
								groups.length > 1
									? "mb-1.5 font-semibold text-[12px] text-muted uppercase tracking-[0.06em]"
									: "sr-only"
							}
						>
							{t(`competition.group.${key}`)}
						</h2>
						<ul
							aria-labelledby={`${listId}-${key}`}
							className="border-line border-t"
						>
							{competitions.map((competition) => (
								<CompetitionCard
									key={competition.id}
									competition={competition}
									year={view.year}
									today={view.day}
									nextDay={schedule.nextDay.get(competition.id)}
									matchdays={schedule.matchdays}
									teamName={teamName}
									onOpen={() =>
										void navigate({
											to: "/competicion/$competition",
											params: { competition: competition.id },
										})
									}
								/>
							))}
						</ul>
					</section>
				))}
			</div>
		</>
	);
}

function RunProgress({ run, year }: { run: AdvanceRun; year: number }) {
	const { t, i18n } = useTranslation();
	const total = Math.max(1, run.toDay - run.fromDay);
	const done = Math.min(total, Math.max(0, run.day - run.fromDay));
	const goal =
		run.mode === "season"
			? t("competition.advance.until.season")
			: run.mode === "day"
				? t("competition.advance.until.day")
				: t("competition.advance.until.stage", {
						competition: competitionName(t, run.target?.competition ?? ""),
						stage: stageName(run.target?.stage ?? ""),
					});
	return (
		<div className="min-w-0">
			<p className="mb-1.5 flex min-w-0 items-baseline gap-3 text-[13px]">
				<b className="shrink-0 font-semibold text-text">
					{t("competition.advance.playingDay", {
						day: run.day,
						date: dayDate(year, run.day, i18n.language),
					})}
				</b>
				<span className="min-w-0 truncate text-muted">{goal}</span>
				<span className="ml-auto shrink-0 text-muted tabular-nums">
					{t("competition.advance.days", { done, total })}
				</span>
			</p>
			<div
				role="progressbar"
				aria-label={t("competition.advance.progress")}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={done}
				aria-valuetext={t("competition.advance.playing", {
					day: run.day,
					end: run.toDay,
				})}
				className="h-1 overflow-hidden bg-line"
			>
				<div
					className="h-full bg-action transition-[width] duration-[420ms] ease-lock motion-reduce:transition-none"
					style={{ width: `${(done / total) * 100}%` }}
				/>
			</div>
		</div>
	);
}
