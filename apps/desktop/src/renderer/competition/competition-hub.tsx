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
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { CoreErrorMessage } from "../core";
import { StageBracket } from "./bracket/stage-bracket";
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
import {
	type CompetitionOverview,
	useExhibitionSeason,
	useSeasonOverview,
} from "./season";
import { StageStandings } from "./standings/stage-standings";

// `/competicion/$competition`: the hub of one competition (plan 31), with a
// view per tab: the standings of a stage (U3), its schedule (U4) and, when the
// stage is played as one, its bracket (U6, #605). What the hub shows lives in
// the route's search, so coming back from a series finds it as it was (U5).

type HubView = "standings" | "schedule" | "bracket";

export interface HubSearch extends CalendarSearch {
	readonly view?: HubView | undefined;
	/** The stage whose standings show; the one in play when absent. */
	readonly stage?: string | undefined;
}

/** The hub's search, from whatever the route receives. */
export function parseHubSearch(search: Record<string, unknown>): HubSearch {
	return {
		view:
			search.view === "schedule" || search.view === "bracket"
				? search.view
				: undefined,
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
				<HubViews
					sessionId={season.data.sessionId}
					competition={competition}
					search={search}
					onSearch={onSearch}
				/>
			)}
			{season.error && <CoreErrorMessage error={season.error} />}
		</section>
	);
}

/** The view control and the chosen view; «Bracket» only for a bracket stage. */
function HubViews({
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
	const { t } = useTranslation();
	const overview = useSeasonOverview(sessionId);
	const stages = overview.data?.competitions.find(
		({ id }) => id === competition,
	)?.stages;
	const selected = stages && selectedStage(stages, search.stage);
	const hasBracket = selected !== undefined && isBracket(selected);
	// A bracket link to a stage without one shows its standings.
	const view =
		search.view === "bracket" && !hasBracket
			? "standings"
			: (search.view ?? "standings");
	const options: { value: HubView; label: string }[] = [
		{ value: "standings", label: t("competition.standings.title") },
		{ value: "schedule", label: t("competition.schedule.label") },
		...(hasBracket
			? [{ value: "bracket" as const, label: t("competition.bracket.label") }]
			: []),
	];
	return (
		<>
			<SegmentedControl
				label={t("competition.hub.view")}
				options={options}
				value={view}
				onChange={(next) =>
					void onSearch({
						...search,
						view: next === "standings" ? undefined : next,
					})
				}
				className="self-start"
			/>
			{view === "schedule" ? (
				<Schedule
					sessionId={sessionId}
					competition={competition}
					search={search}
					onSearch={onSearch}
				/>
			) : (
				overview.data &&
				stages &&
				selected && (
					<StagePanel
						sessionId={sessionId}
						competition={competition}
						year={overview.data.year}
						stages={stages}
						selected={selected}
						view={view}
						onStage={(stage) => void onSearch({ ...search, stage })}
					/>
				)
			)}
		</>
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
					stage: search.stage,
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

type Stage = CompetitionOverview["stages"][number];

const isBracket = ({ play }: Stage) =>
	play === "singleElim" || play === "doubleElim";

/**
 * The stage in the route search; otherwise the one in play, between stages
 * the last one played and, before any, the first.
 */
const selectedStage = (stages: readonly Stage[], chosen: string | undefined) =>
	stages.find(({ stage }) => stage === chosen) ??
	stages.find(({ status }) => status === "live") ??
	[...stages].reverse().find(({ status }) => status === "finished") ??
	stages[0];

/** The stage selector, then the chosen stage's standings (U3) or bracket (U6). */
function StagePanel({
	sessionId,
	competition,
	year,
	stages,
	selected,
	view,
	onStage,
}: {
	sessionId: number;
	competition: string;
	year: number;
	stages: readonly Stage[];
	selected: Stage;
	view: "standings" | "bracket";
	onStage: (stage: string) => void;
}) {
	const { t, i18n } = useTranslation();
	const date = (day: number) => dayDate(year, day, i18n.language);
	const items = stages.map(({ stage }) => ({
		value: stage,
		label: stageName(stage),
	}));
	return (
		<section
			aria-label={t(
				view === "bracket"
					? "competition.bracket.label"
					: "competition.standings.title",
			)}
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
			{view === "bracket" ? (
				<StageBracket
					key={selected.stage}
					sessionId={sessionId}
					competition={competition}
					stage={selected.stage}
				/>
			) : (
				<StageStandings
					key={selected.stage}
					sessionId={sessionId}
					competition={competition}
					stage={selected.stage}
				/>
			)}
		</section>
	);
}
