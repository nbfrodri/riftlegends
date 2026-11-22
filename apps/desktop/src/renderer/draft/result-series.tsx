import type { SeriesSummary } from "@rift-legends/contracts";
import { IconButton } from "@rift-legends/ui-kit/components/icon-button";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clock, type GameResult, gapsOfSeries, percent } from "./result-data";
import { GapsTable } from "./result-gaps";
import { championLabel, teamName, useDraftSession } from "./session";

function Mvp(props: {
	mvp: NonNullable<SeriesSummary["mvp"]>;
	games: readonly GameResult[];
	sideOf: (team: string) => "blue" | "red";
}) {
	const { t, i18n } = useTranslation();
	const { options } = useDraftSession();
	const { mvp } = props;
	const role = props.games[0]?.lines.find((l) => l.player === mvp.player)?.role;
	const name = teamName(options, mvp.team);
	const stats = [
		{
			label: t("draft.result.mvp.rating"),
			value: (
				<>
					{new Intl.NumberFormat(i18n.language).format(mvp.rating / 10)}{" "}
					<small className="text-[15px] text-muted">
						{t("draft.result.mvp.outOf")}
					</small>
				</>
			),
		},
		{
			label: t("draft.result.mvp.kda"),
			value: `${mvp.kills}/${mvp.deaths}/${mvp.assists}`,
		},
		{
			label: t("draft.result.mvp.share"),
			value: t("draft.result.percent", { value: percent(mvp.participation) }),
		},
	];
	return (
		<section
			aria-label={t("draft.result.mvp.name")}
			className={`border-t-[3px] bg-panel p-5 ${props.sideOf(mvp.team) === "blue" ? "border-side-blue" : "border-side-red"}`}
		>
			<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
				{t("draft.result.mvp.label", { team: name })}
			</p>
			<h2 className="mt-3 font-bold font-display text-[32px] leading-none tracking-heading">
				{t("draft.result.stats.playerName", {
					team: name,
					role: role ? t(`draft.roles.role.${role}`) : "",
				})}
			</h2>
			<p className="mt-1 truncate text-[14px] text-muted">
				{new Intl.ListFormat(i18n.language, {
					style: "long",
					type: "conjunction",
				}).format(
					mvp.champions.map((champion, i) =>
						t("draft.result.mvp.champion", {
							champion: championLabel(options, champion),
							game: props.games[i]?.game ?? i + 1,
						}),
					),
				)}
			</p>
			<dl className="my-4 grid grid-cols-3 gap-3 border-line border-y py-3">
				{stats.map((stat) => (
					<div key={stat.label}>
						<dt className="text-[13px] text-muted">{stat.label}</dt>
						<dd className="font-bold font-display text-[29px] leading-tight">
							{stat.value}
						</dd>
					</div>
				))}
			</dl>
			<p className="text-[14px] text-muted">
				{t("draft.result.mvp.why", {
					share: percent(mvp.participation),
					team: name,
				})}
			</p>
		</section>
	);
}

function Recap(props: {
	games: readonly GameResult[];
	teamA: string;
	onOpen: (game: number) => void;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const { games, teamA } = props;
	const teamB =
		games[0]?.blue === teamA ? games[0].red : (games[0]?.blue ?? "");
	const killsOf = (game: GameResult, team: string) =>
		game.blue === team ? game.kills.blue : game.kills.red;
	let winsA = 0;
	let winsB = 0;
	return (
		<section className="bg-panel p-4">
			<h2 className="font-bold font-display text-[19px] tracking-heading">
				{t("draft.result.recap.title")}
			</h2>
			<table
				aria-label={t("draft.result.recap.name")}
				className="mt-2 w-full text-[14px] tabular-nums"
			>
				<thead className="text-left text-muted">
					<tr>
						<th scope="col" className="p-1.5 font-normal">
							{t("draft.result.recap.map")}
						</th>
						<th scope="col" className="p-1.5 font-normal">
							{t("draft.result.recap.winner")}
						</th>
						<th scope="col" className="p-1.5 font-normal">
							{t("draft.result.recap.duration")}
						</th>
						<th scope="col" className="p-1.5 font-normal">
							{t("draft.result.recap.kills", {
								a: teamName(options, teamA),
								b: teamName(options, teamB),
							})}
						</th>
						<th scope="col" className="p-1.5 font-normal">
							{t("draft.result.recap.score")}
						</th>
						<th scope="col" className="w-12 p-1.5">
							<span className="sr-only">{t("draft.result.recap.open")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{games.map((game) => {
						if (game.winner === teamA) winsA += 1;
						else winsB += 1;
						return (
							<tr key={game.game} className="border-line border-t">
								<th scope="row" className="p-1.5 text-left">
									{game.game}
								</th>
								<td className="p-1.5">{teamName(options, game.winner)}</td>
								<td className="p-1.5">{clock(game.duration)}</td>
								<td className="p-1.5">
									{killsOf(game, teamA)} / {killsOf(game, teamB)}
								</td>
								<td className="p-1.5">
									{winsA} – {winsB}
								</td>
								<td className="p-1">
									<IconButton
										icon={ArrowUpRight}
										label={t("draft.result.recap.view", { game: game.game })}
										onClick={() => props.onOpen(game.game)}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}

/** The "Full series" tab: MVP, mean differences by role and the map-by-map recap. */
export function SeriesReport(props: {
	games: readonly GameResult[];
	summary: SeriesSummary | undefined;
	onOpen: (game: number) => void;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const teamA = props.games[0]?.blue ?? "";
	const sideOf = (team: string) => (team === teamA ? "blue" : "red");
	return (
		<div className="grid min-w-0 gap-[14px]">
			<div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-stretch gap-[14px]">
				{props.summary?.mvp && (
					<Mvp mvp={props.summary.mvp} games={props.games} sideOf={sideOf} />
				)}
				<GapsTable
					gaps={gapsOfSeries(props.games, props.summary)}
					options={options}
					sideOf={sideOf}
					name={t("draft.result.gaps.name")}
					note={t("draft.result.gaps.average")}
				/>
			</div>
			<Recap games={props.games} teamA={teamA} onOpen={props.onOpen} />
		</div>
	);
}
