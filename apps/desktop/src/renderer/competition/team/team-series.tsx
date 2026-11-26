import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useTranslation } from "react-i18next";
import { teamName, useSeriesOptions } from "../../draft/session";
import { TeamCrest } from "../../draft/team-crest";
import { dayDate } from "../names";
import { resultText, type TeamSeries } from "./team-text";

// Every series of the season, newest first. Each one opens the read-only
// series view (U5).

export function TeamSeriesList({
	series,
	year,
	where,
	onOpen,
}: {
	series: readonly TeamSeries[];
	year: number;
	/** Competition and stage of a series, in words. */
	where: (series: TeamSeries) => string;
	onOpen: (series: string) => void;
}) {
	const { t, i18n } = useTranslation();
	const options = useSeriesOptions();
	const name = (id: string) => teamName(options, id);
	const label = t("competition.standings.column.series");
	return (
		<section className="flex min-h-0 flex-col gap-1.5">
			<h2 className="font-semibold text-[13px] text-muted uppercase tracking-[0.055em]">
				{label}
			</h2>
			<ol
				aria-label={label}
				className="scroll-edge grid min-h-0 flex-1 content-start overflow-y-auto bg-panel"
			>
				{series.map((entry) => {
					const date = dayDate(year, entry.day, i18n.language);
					const place = where(entry);
					const opponent = name(entry.opponent);
					return (
						<li key={entry.series}>
							<button
								type="button"
								aria-label={t("competition.team.entry", {
									result: resultText(t, entry, name),
									where: place,
									date,
								})}
								onClick={() => onOpen(entry.series)}
								className="press grid w-full cursor-pointer grid-cols-[4rem_minmax(0,1fr)_3rem_5.5rem] items-center gap-3 border-canvas border-b px-3 py-[clamp(8px,1.6vh,14px)] text-left text-[14px] outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action"
							>
								<span className="text-muted tabular-nums">{date}</span>
								<span className="flex min-w-0 flex-col leading-tight">
									<span className="flex min-w-0 items-center gap-2">
										<TeamCrest
											id={entry.opponent}
											name={opponent}
											className="h-5 w-7 shrink-0"
										/>
										<span className="truncate font-semibold">{opponent}</span>
									</span>
									<span className="truncate text-[12px] text-muted">
										{place}
									</span>
								</span>
								<span className="text-center font-display tabular-nums">
									{`${entry.score[0]}–${entry.score[1]}`}
								</span>
								<span
									className={cn(
										"text-right font-semibold",
										entry.won ? "text-good" : "text-bad",
									)}
								>
									{t(`competition.team.${entry.won ? "won" : "lost"}`)}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
