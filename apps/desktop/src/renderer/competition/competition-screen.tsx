import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CoreErrorMessage } from "../core";
import { useSeasonAdvance } from "./advance";
import { AdvanceControls, RunProgress } from "./advance-controls";
import { CompetitionCard } from "./competition-card";
import { dayDate, isInternational } from "./names";
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
				<AdvanceControls
					view={view}
					scope="season"
					run={run}
					pending={pending}
					onStart={(mode) => void start(mode)}
					onStop={stop}
					teamName={teamName}
					onPlayMySeries={onPlayMySeries}
					onRestart={onRestart}
				/>
			</header>
			{run && <RunProgress run={run} year={view.year} scope="season" />}
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
