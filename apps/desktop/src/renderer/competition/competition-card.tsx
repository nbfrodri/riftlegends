import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { TeamCrest } from "../draft/team-crest";
import {
	competitionLogoId,
	competitionName,
	dayDate,
	stageName,
} from "./names";
import { type CompetitionOverview, type Matchdays, stageKeyOf } from "./season";

// One competition of the season overview (plan 31, U1), as a row: name, the
// stage with its match days, the leader or champion and the next match day.
// The state is plain text, never a badge (user feedback on #582). The whole
// row opens the competition.

/** The stage being played, else the next one, else the last. */
const currentStage = ({ stages }: CompetitionOverview) =>
	stages.find(({ status }) => status === "live") ??
	stages.find(({ status }) => status === "pending") ??
	stages.at(-1);

/** The columns every row shares, so the list reads as a table. */
const ROW_COLUMNS =
	"grid-cols-[minmax(150px,1fr)_minmax(210px,1.35fr)_minmax(230px,1.5fr)_minmax(120px,0.8fr)]";

export function CompetitionCard({
	competition,
	year,
	today,
	nextDay,
	matchdays,
	teamName,
	onOpen,
}: {
	competition: CompetitionOverview;
	year: number;
	/** The next day of the season with a series, or `null` once it is over. */
	today: number | null;
	/** The next match day of this competition, when it is known. */
	nextDay: number | undefined;
	matchdays: ReadonlyMap<string, Matchdays>;
	teamName: (id: string) => string;
	onOpen: () => void;
}) {
	const { t, i18n } = useTranslation();
	const name = competitionName(t, competition.id);
	const stage = currentStage(competition);
	const { status, leader, champion, stages } = competition;
	const date = (day: number) => dayDate(year, day, i18n.language);
	const startDay = stages[0]?.startDay ?? 0;
	const days = stage && matchdays.get(stageKeyOf(competition.id, stage.stage));
	const stageLive = stage?.status === "live";
	const share = days && days.total > 0 ? days.played / days.total : 0;

	return (
		<li
			className={`group relative grid min-h-[clamp(44px,6.6vh,66px)] ${ROW_COLUMNS} items-center gap-x-[clamp(12px,1.4vw,28px)] px-[clamp(10px,1vw,16px)] odd:bg-panel hover:bg-surface has-[button:active]:brightness-90 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:-outline-offset-2 has-[button:focus-visible]:outline-action`}
		>
			<div className="flex min-w-0 items-center gap-3">
				<LeagueLogo
					id={competitionLogoId(competition.id)}
					name={name}
					className="size-[clamp(26px,2.3vw,36px)]"
				/>
				<h2 className="min-w-0 truncate font-bold font-display text-[clamp(16px,1.3vw,21px)] leading-none tracking-[-0.03em]">
					{name}
				</h2>
			</div>

			<div className="min-w-0">
				{status === "finished" ? (
					<p className="text-[13px] text-muted">
						{t("competition.status.finished")}
					</p>
				) : (
					<>
						<p className="flex min-w-0 items-baseline justify-between gap-3 text-[13px]">
							<span className="min-w-0 truncate font-semibold">
								{stage && stageName(stage.stage)}
							</span>
							<span className="shrink-0 text-muted tabular-nums">
								{stageLive && days
									? t("competition.matchday", {
											played: days.played,
											total: days.total,
										})
									: t("competition.status.pending")}
							</span>
						</p>
						<div aria-hidden="true" className="mt-1.5 h-0.5 bg-line">
							<div
								className="h-full bg-text transition-[width] duration-300 ease-lock motion-reduce:transition-none"
								style={{ width: `${(stageLive ? share : 0) * 100}%` }}
							/>
						</div>
					</>
				)}
			</div>

			<div className="flex min-w-0 items-center gap-2.5 text-[14px]">
				{status === "finished" && champion ? (
					<>
						<span className="shrink-0 text-[12px] text-muted">
							{t("competition.champion")}
						</span>
						<TeamCrest
							id={champion}
							name={teamName(champion)}
							className="size-6 shrink-0"
						/>
						<b className="min-w-0 truncate">{teamName(champion)}</b>
					</>
				) : leader ? (
					<>
						<span className="shrink-0 text-[12px] text-muted">
							{t("competition.leader")}
						</span>
						<TeamCrest
							id={leader.team}
							name={teamName(leader.team)}
							className="size-6 shrink-0"
						/>
						<b className="min-w-0 truncate">{teamName(leader.team)}</b>
						<span className="ml-auto shrink-0 font-bold font-display tabular-nums tracking-[-0.02em]">
							{t("competition.record", {
								wins: leader.seriesWins,
								losses: leader.seriesLosses,
							})}
						</span>
					</>
				) : status === "pending" && today !== null ? (
					<span className="text-[13px] text-muted">
						{startDay <= today
							? t("competition.startsToday")
							: t("competition.startsIn", { count: startDay - today })}
					</span>
				) : null}
			</div>

			<p className="min-w-0 text-right text-[13px] tabular-nums">
				{status === "pending" ? (
					<>
						<span className="block">{date(startDay)}</span>
						<span className="block text-[12px] text-muted">
							{t("competition.startsOnDay", { day: startDay })}
						</span>
					</>
				) : status === "live" && nextDay !== undefined ? (
					<>
						<span className="block">{date(nextDay)}</span>
						<span className="block text-[12px] text-muted">
							{t("competition.nextDayNumber", { day: nextDay })}
						</span>
					</>
				) : null}
			</p>

			<button
				type="button"
				aria-label={t("competition.open", { name })}
				onClick={onOpen}
				className="absolute inset-0 cursor-pointer outline-none"
			/>
		</li>
	);
}
