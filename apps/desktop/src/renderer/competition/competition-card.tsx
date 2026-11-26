import { cn } from "@rift-legends/ui-kit/lib/utils";
import { CalendarDays, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { TeamCrest } from "../draft/team-crest";
import {
	competitionLogoId,
	competitionName,
	dayDate,
	stageName,
} from "./names";
import type { CompetitionOverview } from "./season";

// One competition of the season overview (plan 31, U1): logo, stage, leader or
// champion and the next match day. The whole card opens the competition.

type Status = CompetitionOverview["status"];

const chip: Record<Status, string> = {
	pending: "border-line text-muted",
	live: "border-good/45 bg-good/12 text-good",
	finished: "border-action/45 bg-action/12 text-action",
};

const segment: Record<Status, string> = {
	pending: "bg-line",
	live: "bg-good",
	finished: "bg-action",
};

/** The stage being played, else the next one, else the last. */
const currentStage = ({ stages }: CompetitionOverview) =>
	stages.find(({ status }) => status === "live") ??
	stages.find(({ status }) => status === "pending") ??
	stages.at(-1);

export function CompetitionCard({
	competition,
	year,
	today,
	nextDay,
	teamName,
	onOpen,
}: {
	competition: CompetitionOverview;
	year: number;
	/** The next day of the season with a series, or `null` once it is over. */
	today: number | null;
	/** The next match day of this competition, when it is known. */
	nextDay: number | undefined;
	teamName: (id: string) => string;
	onOpen: () => void;
}) {
	const { t, i18n } = useTranslation();
	const name = competitionName(t, competition.id);
	const stage = currentStage(competition);
	const { status, leader, champion, stages } = competition;
	const date = (day: number) => dayDate(year, day, i18n.language);
	const startDay = stages[0]?.startDay ?? 0;

	return (
		<li className="group relative flex min-w-0 flex-col gap-[clamp(8px,1.2vh,12px)] border border-line bg-panel p-[clamp(10px,1vw,16px)] hover:border-text hover:bg-surface has-[button:active]:brightness-90 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-action">
			<header className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-3">
				<span className="grid size-[clamp(44px,3.8vw,60px)] place-items-center border border-line bg-canvas">
					<LeagueLogo
						id={competitionLogoId(competition.id)}
						name={name}
						className="size-[72%]"
					/>
				</span>
				<div className="min-w-0">
					<div className="flex min-w-0 items-center justify-between gap-2">
						<h2 className="min-w-0 truncate font-bold font-display text-[clamp(17px,1.45vw,24px)] leading-[1.1] tracking-[-0.03em]">
							{name}
						</h2>
						<span
							className={cn(
								"inline-flex shrink-0 items-center gap-1.5 rounded-control border px-1.5 py-0.5 font-semibold text-[11px] leading-none",
								chip[status],
							)}
						>
							{status === "live" && (
								<span
									aria-hidden="true"
									className="size-1.5 rounded-full bg-current"
								/>
							)}
							{t(`competition.status.${status}`)}
						</span>
					</div>
					<p className="mt-1 flex min-w-0 items-baseline justify-between gap-2 text-[13px]">
						<span className="min-w-0 truncate text-muted">
							{stage && stageName(stage.stage)}
						</span>
						{stage && (
							<span className="shrink-0 text-muted tabular-nums">
								{t("competition.stageOf", {
									index: stages.indexOf(stage) + 1,
									total: stages.length,
								})}
							</span>
						)}
					</p>
				</div>
			</header>
			<StageBar competition={competition} />
			<div className="flex min-h-[clamp(30px,4.2vh,40px)] min-w-0 items-center">
				{status === "finished" && champion ? (
					<Team label={t("competition.champion")} highlight>
						<Trophy
							aria-hidden="true"
							className="size-4 shrink-0 text-action"
						/>
						<TeamCrest
							id={champion}
							name={teamName(champion)}
							className="size-7 shrink-0"
						/>
						<b className="min-w-0 truncate font-display text-[clamp(15px,1.15vw,19px)] tracking-[-0.02em]">
							{teamName(champion)}
						</b>
					</Team>
				) : leader ? (
					<Team label={t("competition.leader")}>
						<TeamCrest
							id={leader.team}
							name={teamName(leader.team)}
							className="size-7 shrink-0"
						/>
						<b className="min-w-0 truncate text-[15px]">
							{teamName(leader.team)}
						</b>
						<span className="ml-auto font-bold font-display text-[clamp(16px,1.25vw,21px)] tabular-nums tracking-[-0.02em]">
							{t("competition.record", {
								wins: leader.seriesWins,
								losses: leader.seriesLosses,
							})}
						</span>
					</Team>
				) : status === "pending" && today !== null ? (
					<p className="flex min-w-0 items-baseline gap-2.5">
						<b className="font-bold font-display text-[clamp(18px,1.5vw,25px)] tracking-[-0.02em]">
							{date(startDay)}
						</b>
						<span className="text-[13px] text-muted">
							{startDay <= today
								? t("competition.startsToday")
								: t("competition.startsIn", { count: startDay - today })}
						</span>
					</p>
				) : null}
			</div>
			{status !== "finished" &&
				(status === "pending" || nextDay !== undefined) && (
					<p className="mt-auto flex items-center gap-1.5 border-line border-t pt-[clamp(6px,0.9vh,10px)] text-[12px] text-muted tabular-nums">
						<CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
						{status === "pending" || nextDay === undefined
							? t("competition.startsOn", {
									day: startDay,
									date: date(startDay),
								})
							: t("competition.nextDay", {
									day: nextDay,
									date: date(nextDay),
								})}
					</p>
				)}
			<button
				type="button"
				aria-label={t("competition.open", { name })}
				onClick={onOpen}
				className="absolute inset-0 cursor-pointer outline-none"
			/>
		</li>
	);
}

/** One segment per stage, in order: done, under way or still to play. */
function StageBar({ competition }: { competition: CompetitionOverview }) {
	return (
		<div aria-hidden="true" className="flex h-1 gap-0.5">
			{competition.stages.map(({ stage, status }) => (
				<span key={stage} className={cn("min-w-0 flex-1", segment[status])} />
			))}
		</div>
	);
}

function Team({
	label,
	highlight = false,
	children,
}: {
	label: string;
	highlight?: boolean;
	children: ReactNode;
}) {
	return (
		<div className="flex w-full min-w-0 items-center gap-2.5">
			<span
				className={cn(
					"w-[clamp(52px,4.4vw,68px)] shrink-0 text-[12px]",
					highlight ? "font-semibold text-action" : "text-muted",
				)}
			>
				{label}
			</span>
			{children}
		</div>
	);
}
