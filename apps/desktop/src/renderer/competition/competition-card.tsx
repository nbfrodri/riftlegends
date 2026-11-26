import { cn } from "@rift-legends/ui-kit/lib/utils";
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

const crest = "size-6 shrink-0";

const statusTone = {
	pending: "text-muted",
	live: "text-good",
	finished: "text-text",
} as const;

/** The stage being played, else the next one, else the last. */
const currentStage = ({ stages }: CompetitionOverview) =>
	stages.find(({ status }) => status === "live") ??
	stages.find(({ status }) => status === "pending") ??
	stages.at(-1);

export function CompetitionCard({
	competition,
	year,
	nextDay,
	teamName,
	onOpen,
}: {
	competition: CompetitionOverview;
	year: number;
	/** The next match day of this competition, when it is known. */
	nextDay: number | undefined;
	teamName: (id: string) => string;
	onOpen: () => void;
}) {
	const { t, i18n } = useTranslation();
	const name = competitionName(t, competition.id);
	const stage = currentStage(competition);
	const date = (day: number) => ({
		day,
		date: dayDate(year, day, i18n.language),
	});
	const { status, leader, champion } = competition;
	const startDay = competition.stages[0]?.startDay ?? 0;

	return (
		<li className="group relative flex min-h-0 flex-col gap-[clamp(6px,1vh,10px)] border border-line bg-panel p-[clamp(10px,1vw,16px)] hover:border-text hover:bg-surface has-[button:active]:brightness-90 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-action">
			<header className="flex min-w-0 items-center gap-2.5">
				<LeagueLogo
					id={competitionLogoId(competition.id)}
					name={name}
					className="size-[clamp(28px,2.6vw,40px)]"
				/>
				<h2 className="min-w-0 truncate font-bold font-display text-[clamp(16px,1.35vw,22px)] leading-[1.1] tracking-[-0.03em]">
					{name}
				</h2>
			</header>
			<p className="flex items-center justify-between gap-2 text-[13px]">
				<span className="min-w-0 truncate text-muted">
					{stage && stageName(stage.stage)}
				</span>
				<span className={cn("shrink-0 font-semibold", statusTone[status])}>
					{t(`competition.status.${status}`)}
				</span>
			</p>
			{status === "finished" && champion ? (
				<Team label={t("competition.champion")}>
					<span className={crest}>
						<TeamCrest
							id={champion}
							name={teamName(champion)}
							className="size-6"
						/>
					</span>
					<b className="min-w-0 truncate">{teamName(champion)}</b>
				</Team>
			) : leader ? (
				<Team label={t("competition.leader")}>
					<span className={crest}>
						<TeamCrest
							id={leader.team}
							name={teamName(leader.team)}
							className="size-6"
						/>
					</span>
					<b className="min-w-0 truncate">{teamName(leader.team)}</b>
					<span className="ml-auto text-muted tabular-nums">
						{t("competition.record", {
							wins: leader.seriesWins,
							losses: leader.seriesLosses,
						})}
					</span>
				</Team>
			) : null}
			<p className="mt-auto text-[13px] text-muted tabular-nums">
				{status === "pending"
					? t("competition.startsOn", date(startDay))
					: status === "live" && nextDay !== undefined
						? t("competition.nextDay", date(nextDay))
						: null}
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

function Team({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0">
			<p className="text-[12px] text-muted">{label}</p>
			<p className="mt-1 flex min-w-0 items-center gap-2 text-[15px]">
				{children}
			</p>
		</div>
	);
}
