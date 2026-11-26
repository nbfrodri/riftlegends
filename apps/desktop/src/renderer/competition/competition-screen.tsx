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
import { competitionName, dayDate, stageName } from "./names";
import {
	type SeasonHandle,
	useExhibitionSeason,
	useNextDays,
	useSeasonOverview,
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
	const nextDays = useNextDays(season.sessionId, overview.data?.day ?? null);
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

	return (
		<>
			<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<Heading>
					<p className="mt-2 text-[14px] text-muted tabular-nums">
						{t("competition.season", { year: view.year })}
						{" · "}
						{view.day === null ? (
							<b className="font-semibold text-text">{t("competition.over")}</b>
						) : (
							t("competition.today", {
								day: view.day,
								date: dayDate(view.year, view.day, i18n.language),
							})
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
			{run && <RunProgress run={run} />}
			{error && <CoreErrorMessage error={error} />}
			<h2 id={listId} className="sr-only">
				{t("competition.cards")}
			</h2>
			<ul
				aria-labelledby={listId}
				className="grid min-h-0 flex-1 auto-rows-fr grid-cols-[repeat(auto-fill,minmax(clamp(190px,17vw,300px),1fr))] content-start gap-[clamp(8px,0.8vw,14px)] overflow-y-auto"
			>
				{view.competitions.map((competition) => (
					<CompetitionCard
						key={competition.id}
						competition={competition}
						year={view.year}
						nextDay={nextDays.get(competition.id)}
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
		</>
	);
}

function RunProgress({ run }: { run: AdvanceRun }) {
	const { t } = useTranslation();
	const total = Math.max(1, run.toDay - run.fromDay);
	const done = Math.min(total, Math.max(0, run.day - run.fromDay));
	return (
		<div>
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
				className="h-1.5 overflow-hidden rounded-control bg-line"
			>
				<div
					className="h-full bg-action transition-[width] duration-300 ease-lock motion-reduce:transition-none"
					style={{ width: `${(done / total) * 100}%` }}
				/>
			</div>
			<p
				aria-hidden="true"
				className="mt-1.5 text-[13px] text-muted tabular-nums"
			>
				{t("competition.advance.playing", { day: run.day, end: run.toDay })}
			</p>
		</div>
	);
}
