import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { CoreErrorMessage } from "../core";
import { useActiveSeason } from "./active-season";
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
import { type CompetitionOverview, useSeasonOverview } from "./season";
import { StageStandings } from "./standings/stage-standings";

// `/competicion/$competition`: the hub of one competition (plan 31), with a
// view per tab: the standings of a stage (U3) and its schedule (U4). What the hub shows lives in
// the route's search, so coming back from a series finds it as it was (U5).

type HubView = "standings" | "schedule";

export interface HubSearch extends CalendarSearch {
	readonly view?: HubView | undefined;
	/** The stage whose standings show; the one in play when absent. */
	readonly stage?: string | undefined;
}

/** The hub's search, from whatever the route receives. */
export function parseHubSearch(search: Record<string, unknown>): HubSearch {
	return {
		view: search.view === "schedule" ? "schedule" : undefined,
		stage:
			typeof search.stage === "string" && search.stage.length > 0
				? search.stage
				: undefined,
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
	header,
}: {
	competition: string;
	search?: HubSearch;
	/** Replaces the hub's search in place (no new history entry). */
	onSearch: (search: HubSearch) => Promise<void>;
	/** Replaces the logo, name and back button (the tournament's own controls). */
	header?: ReactNode;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const season = useActiveSeason();
	const name = competitionName(t, competition);
	const view = search.view ?? "standings";
	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			{header ?? (
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
			)}
			<SegmentedControl
				label={t("competition.hub.view")}
				options={[
					{ value: "standings", label: t("competition.standings.title") },
					{ value: "schedule", label: t("competition.schedule.label") },
				]}
				value={view}
				onChange={(next) =>
					void onSearch({
						...search,
						view: next === "standings" ? undefined : next,
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
					<StandingsPanel
						sessionId={season.data.sessionId}
						competition={competition}
						chosen={search.stage}
						onStage={(stage) => void onSearch({ ...search, stage })}
					/>
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
	const { seriesRoute } = useActiveSeason();
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
					stage: search.stage,
					scope: scope === competition ? undefined : scope,
					team,
					calendar: mode === "week" ? undefined : mode,
					day,
				})
			}
			onOpen={(slot) =>
				void navigate({
					to: seriesRoute,
					params: { series: slot.id },
				})
			}
		/>
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
	chosen,
	onStage,
}: {
	sessionId: number;
	competition: string;
	/** The stage in the route search, if any. */
	chosen: string | undefined;
	onStage: (stage: string) => void;
}) {
	const { t, i18n } = useTranslation();
	const overview = useSeasonOverview(sessionId);
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
					onValueChange={(value) => value && onStage(value)}
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
