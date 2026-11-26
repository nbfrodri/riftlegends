import { Button } from "@rift-legends/ui-kit/components/button";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { CoreErrorMessage } from "../core";
import {
	competitionLogoId,
	competitionName,
	dayDate,
	stageName,
} from "./names";
import { useExhibitionSeason, useSeasonOverview } from "./season";

// `/competicion/$competition`: the hub of one competition (plan 31). This
// first version lists its stages; standings, calendar and bracket come with
// their own issues (U3–U7).

const tone = {
	pending: "text-muted",
	live: "text-text",
	finished: "text-muted",
} as const;

export function CompetitionHub({ competition }: { competition: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const season = useExhibitionSeason();
	const name = competitionName(t, competition);
	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<LeagueLogo
						id={competitionLogoId(competition)}
						name={name}
						className="size-[clamp(32px,3vw,48px)]"
					/>
					<h1 className="min-w-0 truncate font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
						{name}
					</h1>
				</div>
				<Button
					variant="secondary"
					onClick={() => void navigate({ to: "/competicion" })}
				>
					{t("competition.hub.back")}
				</Button>
			</header>
			{season.data && (
				<Stages sessionId={season.data.sessionId} competition={competition} />
			)}
			{season.error && <CoreErrorMessage error={season.error} />}
		</section>
	);
}

function Stages({
	sessionId,
	competition,
}: {
	sessionId: number;
	competition: string;
}) {
	const { t, i18n } = useTranslation();
	const overview = useSeasonOverview(sessionId);
	const view = overview.data;
	const stages = view?.competitions.find(
		({ id }) => id === competition,
	)?.stages;
	if (!view || !stages) return null;
	const date = (day: number) => dayDate(view.year, day, i18n.language);
	return (
		<section aria-labelledby="competition-stages" className="min-h-0">
			<h2
				id="competition-stages"
				className="mb-2 font-bold font-display text-[clamp(16px,1.45vw,23px)] tracking-[-0.045em]"
			>
				{t("competition.hub.stages")}
			</h2>
			<ol className="grid max-h-full gap-1 overflow-y-auto scroll-edge">
				{stages.map(({ stage, status, startDay, endDay }) => (
					<li
						key={stage}
						className="grid grid-cols-[1fr_auto_auto] items-center gap-4 bg-panel px-3 py-2 text-[14px]"
					>
						<span className="min-w-0 truncate font-semibold">
							{stageName(stage)}
						</span>
						<span className="text-muted tabular-nums">
							{t("competition.hub.days", {
								start: date(startDay),
								end: date(endDay),
							})}
						</span>
						<span className={cn("w-24 text-right font-semibold", tone[status])}>
							{t(`competition.status.${status}`)}
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
