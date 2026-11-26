import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../../shared/bridge";
import { LeagueLogo } from "../../assets/league-logo";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { SeriesContentProvider } from "../../draft/session";
import { TeamCrest } from "../../draft/team-crest";
import { useExhibitionSeason, useSeasonOverview } from "../season";
import { TeamChampions } from "./team-champions";
import { TeamRoster } from "./team-roster";
import { TeamSeriesList } from "./team-series";
import { TeamSummary } from "./team-summary";
import type { TeamProfile } from "./team-text";

// `/competicion/equipo/$team` (plan 31, U8): a team in the current season
// only (decision 5). Header, a line of results, the roster with each player's
// season and the series, newest first; a played series opens read-only.

const page =
	"flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] overflow-y-auto px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]";

const seasonFact = (fact: CoreFact) => fact.type.startsWith("competition.");

export function TeamScreen({ team }: { team: string }) {
	const season = useExhibitionSeason();
	return (
		<section className={page}>
			{season.error && <CoreErrorMessage error={season.error} />}
			{season.data && (
				<SeriesContentProvider sessionId={season.data.sessionId}>
					<LoadedTeam sessionId={season.data.sessionId} team={team} />
				</SeriesContentProvider>
			)}
		</section>
	);
}

function LoadedTeam({ sessionId, team }: { sessionId: number; team: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const overview = useSeasonOverview(sessionId);
	const profile = useCoreQuery<TeamProfile>(
		{ v: CONTRACT_VERSION, kind: "team.profile", sessionId, params: { team } },
		{ affectedBy: seasonFact },
	);
	if (profile.error)
		return (
			<>
				<Back />
				<CoreErrorMessage error={profile.error} />
			</>
		);
	const year = overview.data?.year;
	if (!profile.data || year === undefined) return null;
	const data = profile.data;
	const played = data.series.length > 0;
	return (
		<>
			<Header profile={data} />
			{played ? (
				<TeamSummary profile={data} />
			) : (
				<p className="text-muted">{t("competition.team.notPlayed")}</p>
			)}
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-[clamp(12px,1.4vw,24px)]">
				<div className="flex min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)]">
					<TeamRoster profile={data} />
					{data.stats.champions.length > 0 && (
						<TeamChampions champions={data.stats.champions} />
					)}
				</div>
				{played && (
					<TeamSeriesList
						series={data.series}
						year={year}
						onOpen={(series) =>
							void navigate({
								to: "/competicion/serie/$series",
								params: { series },
							})
						}
					/>
				)}
			</div>
		</>
	);
}

function Header({ profile }: { profile: TeamProfile }) {
	const { t } = useTranslation();
	const { team } = profile;
	return (
		<header className="flex items-start justify-between gap-3">
			<div className="flex min-w-0 items-center gap-3">
				<TeamCrest
					id={team.id}
					name={team.name}
					className="h-[clamp(36px,3.4vw,58px)] w-[clamp(46px,4.4vw,74px)] shrink-0"
				/>
				<div className="min-w-0">
					<h1 className="truncate font-bold font-display text-[clamp(24px,2.1vw,40px)] uppercase leading-none tracking-heading">
						{team.name}
					</h1>
					<p className="mt-1 flex items-center gap-1.5 text-muted">
						{team.league && (
							<span aria-hidden="true">
								<LeagueLogo id={team.league} name={team.league} />
							</span>
						)}
						{team.league
							? t("draft.setup.leagueSeed", {
									league: team.league,
									n: team.seed,
								})
							: t("draft.setup.seed", { n: team.seed })}
					</p>
				</div>
			</div>
			<Back />
		</header>
	);
}

function Back() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigate = useNavigate();
	const canGoBack = useCanGoBack();
	return (
		<Button
			variant="secondary"
			className="ms-auto"
			onClick={() =>
				canGoBack
					? router.history.back()
					: void navigate({ to: "/competicion" })
			}
		>
			{t("competition.series.back")}
		</Button>
	);
}
