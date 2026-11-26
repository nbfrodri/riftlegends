import { useTranslation } from "react-i18next";
import { ChampionPortrait } from "../../draft/champion-portrait";
import { championLabel, useSeriesOptions } from "../../draft/session";
import type { TeamProfile } from "./team-text";

/** The five champions the team played most this season. */
export function TeamChampions({
	champions,
}: {
	champions: TeamProfile["stats"]["champions"];
}) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const label = t("competition.team.champions");
	return (
		<section className="flex flex-col gap-1.5">
			<h2 className="font-semibold text-[13px] text-muted uppercase tracking-[0.055em]">
				{label}
			</h2>
			<ol aria-label={label} className="flex gap-[clamp(8px,1vw,16px)]">
				{champions.map(({ champion, games }) => {
					const name = championLabel(options, champion);
					return (
						<li
							key={champion}
							className="flex min-w-0 items-center gap-2 bg-panel py-1.5 ps-1.5 pe-3"
						>
							<ChampionPortrait id={champion} size="ban" />
							<span className="flex min-w-0 flex-col leading-tight">
								<span className="truncate font-semibold text-[14px]">
									{name}
								</span>
								<span className="text-[12px] text-muted tabular-nums">
									{t("competition.team.games", { count: games })}
								</span>
							</span>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
