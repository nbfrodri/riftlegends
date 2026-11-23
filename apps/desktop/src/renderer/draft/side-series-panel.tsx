import type { Side } from "@rift-legends/contracts";
import { MousePointer2, Trophy } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { GameResult } from "./result-data";
import { type SeriesRules, teamName, useDraftSession } from "./session";

const WINS_NEEDED: Record<SeriesRules["format"], number> = {
	bo1: 1,
	bo3: 2,
	bo5: 3,
};
const SIDES = ["blue", "red"] as const;
const cell = "px-2 py-1";

type MapSides = Record<Side, string> & { game: number; winner?: string };

/** The team on each side of a map, with its win and whether it chose the side. */
function SideCells({ map }: { map: MapSides }) {
	const { t } = useTranslation();
	const { options, sideChoosers } = useDraftSession();
	return SIDES.map((side) => {
		const team = map[side];
		const name = teamName(options, team);
		return (
			<td key={side} className={cell}>
				<span className="flex min-w-0 items-center gap-1.5">
					<span className="truncate font-medium" title={name}>
						{name}
					</span>
					{sideChoosers[map.game] === team && (
						<MousePointer2
							role="img"
							aria-label={t("draft.side.choseSide")}
							className="size-3.5 shrink-0 text-muted"
						/>
					)}
					{map.winner === team && (
						<Trophy
							role="img"
							aria-label={t("draft.result.recap.winner")}
							className="ml-auto size-4 shrink-0 text-action"
						/>
					)}
				</span>
			</td>
		);
	});
}

/**
 * The series so far: its rules, then each map with the team on each side, who
 * chose it and who won. The current map closes the table.
 */
export function SideSeriesPanel(props: {
	rules: SeriesRules;
	games: readonly GameResult[];
}) {
	const { t } = useTranslation();
	const { view } = useDraftSession();
	const id = useId();
	if (!view) return null;
	const { rules, games } = props;
	const taken = view.choices.find(
		({ choice }) => choice === "blue" || choice === "red",
	);
	const rival = taken?.team === view.blue.team ? view.red.team : view.blue.team;
	const current =
		view.phase !== "side"
			? { blue: view.blue.team, red: view.red.team }
			: taken
				? {
						blue: taken.choice === "blue" ? taken.team : rival,
						red: taken.choice === "red" ? taken.team : rival,
					}
				: null;
	return (
		<section
			aria-labelledby={id}
			className="flex min-w-0 flex-col gap-3 border-line border-t-[3px] bg-panel p-4 short:gap-2 short:p-3"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3">
				<h2 id={id} className="font-bold font-display text-lg tracking-heading">
					{t("draft.side.series")}
				</h2>
				<p className="flex items-baseline gap-2">
					<b>{t(`draft.setup.format.${rules.format}`)}</b>
					<span className="text-muted">
						{t("draft.side.toWin", { count: WINS_NEEDED[rules.format] })}
					</span>
				</p>
			</div>
			<p className="flex gap-2">
				<span className="text-muted">{t("draft.setup.fearless")}</span>
				<b>{t(`draft.setup.fearless.${rules.fearless}`)}</b>
			</p>
			<table
				aria-label={t("draft.result.recap.name")}
				className="w-full table-fixed text-left text-[14px] tabular-nums leading-5"
			>
				<thead>
					<tr className="text-muted">
						<th scope="col" className={`w-[30%] font-medium ${cell}`}>
							{t("draft.result.recap.map")}
						</th>
						<th scope="col" className={`text-side-blue ${cell}`}>
							{t("draft.side.column.blue")}
						</th>
						<th scope="col" className={`text-side-red ${cell}`}>
							{t("draft.side.column.red")}
						</th>
					</tr>
				</thead>
				<tbody>
					{games.map((map) => (
						<tr key={map.game} className="border-line border-t">
							<th scope="row" className={`font-medium text-muted ${cell}`}>
								{t("draft.score.game", { game: map.game })}
							</th>
							<SideCells map={map} />
						</tr>
					))}
					<tr aria-current="step" className="border-line border-t bg-surface">
						<th
							scope="row"
							className={`border-action border-l-2 font-bold ${cell}`}
						>
							{t("draft.score.game", { game: view.game })}
						</th>
						{!current ? (
							<td colSpan={2} className={`text-muted ${cell}`}>
								{t("draft.side.pending")}
							</td>
						) : (
							<SideCells
								map={{
									game: view.game,
									...current,
								}}
							/>
						)}
					</tr>
				</tbody>
			</table>
			{games.length > 0 && (
				<p className="flex flex-wrap items-center gap-x-4 text-[13px] text-muted">
					<span className="inline-flex items-center gap-1.5">
						<MousePointer2 aria-hidden="true" className="size-3.5" />
						{t("draft.side.choseSide")}
					</span>
					<span className="inline-flex items-center gap-1.5">
						<Trophy aria-hidden="true" className="size-3.5 text-action" />
						{t("draft.result.recap.winner")}
					</span>
				</p>
			)}
		</section>
	);
}
