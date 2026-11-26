import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { teamName, useSeriesOptions } from "../../draft/session";
import { minutes, resultText, type TeamProfile } from "./team-text";

// One line of the season so far: form (the latest first), streak, series and
// games won and lost, and the average game. Plain text and numbers.

export function TeamSummary({ profile }: { profile: TeamProfile }) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const name = (id: string) => teamName(options, id);
	const { stats, streak } = profile;
	const record = (wins: number, losses: number) =>
		t("competition.record", { wins, losses });
	return (
		<dl className="flex flex-wrap items-end gap-x-[clamp(20px,2.6vw,44px)] gap-y-2 bg-panel px-4 py-3">
			<Item label={t("competition.team.form")}>
				<ol
					aria-label={t("competition.team.form")}
					className="flex items-baseline gap-1.5"
				>
					{profile.recent.map((series) => {
						const text = resultText(t, series, name);
						return (
							<li key={series.series}>
								<Tooltip content={text}>
									<span
										className={cn(
											"inline-block w-[1.1em] text-center",
											series.won ? "text-good" : "text-bad",
										)}
									>
										<span aria-hidden="true">
											{t(
												`competition.team.short.${series.won ? "won" : "lost"}`,
											)}
										</span>
										<span className="sr-only">{text}</span>
									</span>
								</Tooltip>
							</li>
						);
					})}
				</ol>
			</Item>
			{streak && (
				<Item label={t("competition.team.streak")}>
					{t(`competition.team.streak.${streak.result}`, {
						count: streak.length,
					})}
				</Item>
			)}
			<Item label={t("competition.standings.column.series")}>
				{record(stats.seriesWon, stats.seriesLost)}
			</Item>
			<Item label={t("competition.standings.column.games")}>
				{record(stats.gamesWon, stats.gamesLost)}
			</Item>
			{stats.averageDuration !== null && (
				<Item label={t("competition.team.duration")}>
					{minutes(stats.averageDuration)}
				</Item>
			)}
		</dl>
	);
}

function Item({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
				{label}
			</dt>
			<dd className="m-0 font-bold font-display text-[clamp(17px,1.45vw,24px)] tabular-nums leading-tight">
				{children}
			</dd>
		</div>
	);
}
