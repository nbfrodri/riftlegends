import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
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
import {
	type CalendarSearch,
	parseCalendarSearch,
	ScheduleView,
} from "./schedule-view";
import { useExhibitionSeason, useSeasonOverview } from "./season";

// `/competicion/$competition`: the hub of one competition (plan 31), with a
// view per tab: its stages and its schedule (U4). What the hub shows lives in
// the route's search, so coming back from a series finds it as it was (U5).

type HubView = "stages" | "schedule";

export interface HubSearch extends CalendarSearch {
	readonly view?: HubView | undefined;
}

/** The hub's search, from whatever the route receives. */
export function parseHubSearch(search: Record<string, unknown>): HubSearch {
	return {
		view: search.view === "schedule" ? "schedule" : undefined,
		...parseCalendarSearch(search),
	};
}

const tone = {
	pending: "text-muted",
	live: "text-text",
	finished: "text-muted",
} as const;

export function CompetitionHub({
	competition,
	search = {},
	onSearch,
}: {
	competition: string;
	search?: HubSearch;
	/** Replaces the hub's search in place (no new history entry). */
	onSearch: (search: HubSearch) => Promise<void>;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const season = useExhibitionSeason();
	const name = competitionName(t, competition);
	const view = search.view ?? "stages";
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
			<SegmentedControl
				label={t("competition.hub.view")}
				options={[
					{ value: "stages", label: t("competition.hub.stages") },
					{ value: "schedule", label: t("competition.schedule.label") },
				]}
				value={view}
				onChange={(next) =>
					void onSearch({
						...search,
						view: next === "stages" ? undefined : next,
					})
				}
				className="self-start"
			/>
			{season.data &&
				(view === "schedule" ? (
					<Schedule
						sessionId={season.data.sessionId}
						competition={competition}
						search={search}
						onSearch={onSearch}
					/>
				) : (
					<Stages sessionId={season.data.sessionId} competition={competition} />
				))}
			{season.error && <CoreErrorMessage error={season.error} />}
		</section>
	);
}

function Schedule({
	sessionId,
	competition,
	search,
	onSearch,
}: {
	sessionId: number;
	competition: string;
	search: HubSearch;
	onSearch: (search: HubSearch) => Promise<void>;
}) {
	const navigate = useNavigate();
	const overview = useSeasonOverview(sessionId);
	if (!overview.data) return null;
	return (
		<ScheduleView
			sessionId={sessionId}
			overview={overview.data}
			filters={{
				scope: search.scope ?? competition,
				team: search.team,
				mode: search.calendar ?? "week",
				day: search.day,
			}}
			onFilters={({ scope, team, mode, day }) =>
				void onSearch({
					view: "schedule",
					scope: scope === competition ? undefined : scope,
					team,
					calendar: mode === "week" ? undefined : mode,
					day,
				})
			}
			onOpen={(slot) =>
				void navigate({
					to: "/competicion/serie/$series",
					params: { series: slot.id },
				})
			}
		/>
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
