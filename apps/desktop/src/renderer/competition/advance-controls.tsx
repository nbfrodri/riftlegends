import { Button } from "@rift-legends/ui-kit/components/button";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useTranslation } from "react-i18next";
import {
	type AdvanceMode,
	type AdvanceRun,
	type PendingSeries,
	stageTarget,
} from "./advance";
import { competitionName, dayDate, stageName } from "./names";
import type { SeasonOverview } from "./season";

// «Jugar día», «Hasta fin de fase» and «Toda la temporada» with their progress
// (plan 31, U2), shared by the exhibition season and the tournament (U10).

/** `season`: the exhibition season; `tournament`: a tournament of «Torneo». */
export type AdvanceScope = "season" | "tournament";

export function AdvanceControls({
	view,
	scope,
	run,
	pending,
	onStart,
	onStop,
	teamName,
	onPlayMySeries,
	onRestart,
}: {
	view: SeasonOverview;
	scope: AdvanceScope;
	run: AdvanceRun | null;
	pending: PendingSeries | null;
	onStart: (mode: AdvanceMode) => void;
	onStop: () => void;
	teamName: (id: string) => string;
	/** Opens the user's series; without it the button stays disabled. */
	onPlayMySeries?: ((series: string) => void) | undefined;
	/** Offered once it is over: a new season or a new tournament. */
	onRestart: () => void;
}) {
	const { t } = useTranslation();
	const over = view.day === null;
	const busy = run !== null || pending !== null || over;
	const target = stageTarget(view);
	const play = (mode: AdvanceMode) => () => onStart(mode);
	return (
		<fieldset
			aria-label={t("competition.advance.label")}
			className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
		>
			{pending && (
				<>
					<span className="text-[14px]">
						{t("competition.advance.pending", {
							a: teamName(pending.teams[0]),
							b: teamName(pending.teams[1]),
						})}
					</span>
					<Button
						disabled={!onPlayMySeries}
						onClick={() => onPlayMySeries?.(pending.series)}
					>
						{t("competition.advance.mySeries")}
					</Button>
				</>
			)}
			{run && (
				<Button variant="secondary" onClick={onStop}>
					{t("competition.advance.stop")}
				</Button>
			)}
			<Button
				variant={pending ? "secondary" : "default"}
				disabled={busy}
				onClick={play("day")}
			>
				{t("competition.advance.day")}
			</Button>
			<Tooltip
				disabled={busy || !target}
				content={
					target
						? t("competition.advance.stageHint", {
								competition: competitionName(t, target.competition),
								stage: stageName(target.stage),
							})
						: ""
				}
			>
				<Button variant="secondary" disabled={busy} onClick={play("stage")}>
					{t("competition.advance.stage")}
				</Button>
			</Tooltip>
			<Button variant="secondary" disabled={busy} onClick={play("season")}>
				{t(
					scope === "season"
						? "competition.advance.season"
						: "competition.advance.tournament",
				)}
			</Button>
			{over && (
				<Button
					variant={scope === "tournament" ? "default" : "secondary"}
					onClick={onRestart}
				>
					{t(
						scope === "tournament" ? "tournament.new" : "competition.newSeason",
					)}
				</Button>
			)}
		</fieldset>
	);
}

export function RunProgress({
	run,
	year,
	scope,
}: {
	run: AdvanceRun;
	year: number;
	scope: AdvanceScope;
}) {
	const { t, i18n } = useTranslation();
	const total = Math.max(1, run.toDay - run.fromDay);
	const done = Math.min(total, Math.max(0, run.day - run.fromDay));
	const goal =
		run.mode === "season"
			? t(`competition.advance.until.${scope}`)
			: run.mode === "day"
				? t("competition.advance.until.day")
				: t("competition.advance.until.stage", {
						competition: competitionName(t, run.target?.competition ?? ""),
						stage: stageName(run.target?.stage ?? ""),
					});
	return (
		<div className="min-w-0">
			<p className="mb-1.5 flex min-w-0 items-baseline gap-3 text-[13px]">
				<b className="shrink-0 font-semibold text-text">
					{t("competition.advance.playingDay", {
						day: run.day,
						date: dayDate(year, run.day, i18n.language),
					})}
				</b>
				<span className="min-w-0 truncate text-muted">{goal}</span>
				<span className="ml-auto shrink-0 text-muted tabular-nums">
					{t("competition.advance.days", { done, total })}
				</span>
			</p>
			<div
				role="progressbar"
				aria-label={t(
					scope === "season"
						? "competition.advance.progress"
						: "competition.advance.progressTournament",
				)}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={done}
				aria-valuetext={t("competition.advance.playing", {
					day: run.day,
					end: run.toDay,
				})}
				className="h-1 overflow-hidden bg-line"
			>
				<div
					className="h-full bg-action transition-[width] duration-[420ms] ease-lock motion-reduce:transition-none"
					style={{ width: `${(done / total) * 100}%` }}
				/>
			</div>
		</div>
	);
}
