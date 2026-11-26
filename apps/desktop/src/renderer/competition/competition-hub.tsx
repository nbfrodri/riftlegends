import { Button } from "@rift-legends/ui-kit/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { CoreErrorMessage } from "../core";
import {
	competitionLogoId,
	competitionName,
	dayDate,
	stageName,
} from "./names";
import {
	type CompetitionOverview,
	useExhibitionSeason,
	useSeasonOverview,
} from "./season";
import { StageStandings } from "./standings/stage-standings";

// `/competicion/$competition`: the hub of one competition (plan 31). It shows
// the standings of a stage (U3); calendar and bracket come with their own
// issues (U4–U7).

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
				<StandingsPanel
					sessionId={season.data.sessionId}
					competition={competition}
				/>
			)}
			{season.error && <CoreErrorMessage error={season.error} />}
		</section>
	);
}

type Stage = CompetitionOverview["stages"][number];

/** The stage in play; between stages the last one played; before any, the first. */
const defaultStage = (stages: readonly Stage[]) =>
	(
		stages.find(({ status }) => status === "live") ??
		[...stages].reverse().find(({ status }) => status === "finished") ??
		stages[0]
	)?.stage;

/** The standings of the chosen stage, with the stage selector (U3). */
function StandingsPanel({
	sessionId,
	competition,
}: {
	sessionId: number;
	competition: string;
}) {
	const { t, i18n } = useTranslation();
	const overview = useSeasonOverview(sessionId);
	const [chosen, setChosen] = useState<string>();
	const view = overview.data;
	const stages = view?.competitions.find(
		({ id }) => id === competition,
	)?.stages;
	if (!view || !stages) return null;
	const selected =
		stages.find(({ stage }) => stage === chosen) ??
		stages.find(({ stage }) => stage === defaultStage(stages));
	if (!selected) return null;
	const date = (day: number) => dayDate(view.year, day, i18n.language);
	const items = stages.map(({ stage }) => ({
		value: stage,
		label: stageName(stage),
	}));
	return (
		<section
			aria-label={t("competition.standings.title")}
			className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.2vh,14px)]"
		>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
				<Select
					items={items}
					value={selected.stage}
					onValueChange={(value) => value && setChosen(value)}
				>
					<SelectTrigger
						aria-label={t("competition.hub.stage")}
						className="min-w-[14rem]"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map(({ value, label }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="text-muted tabular-nums">
					{t("competition.hub.days", {
						start: date(selected.startDay),
						end: date(selected.endDay),
					})}
				</span>
				<span className={cn("font-semibold", tone[selected.status])}>
					{t(`competition.status.${selected.status}`)}
				</span>
			</div>
			<StageStandings
				key={selected.stage}
				sessionId={sessionId}
				competition={competition}
				stage={selected.stage}
			/>
		</section>
	);
}
