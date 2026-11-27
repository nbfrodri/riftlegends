import type { SeriesSummary } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { isObjectiveKind, MapIcon } from "../assets/map-icon";
import { PlayerPortrait } from "./board/player-card";
import { ChampionPortrait } from "./champion-portrait";
import { CountryFlag } from "./country-flag";
import {
	clock,
	type GameResult,
	gapsOfSeries,
	mostPlayed,
	percent,
} from "./result-data";
import { Victory } from "./result-game";
import { GapsTable } from "./result-gaps";
import {
	championLabel,
	playerProfile,
	teamName,
	useSeriesOptions,
} from "./session";
import { TeamCrest } from "./team-crest";

/** A team's logo (its own crest without one) in a fixed box. */
function Crest(props: { team: string; className: string }) {
	const options = useSeriesOptions();
	return (
		<span data-crest className="flex shrink-0">
			<TeamCrest
				id={props.team}
				name={teamName(options, props.team)}
				className={props.className}
			/>
		</span>
	);
}

/** The series banner: the winner with its logo and the final score (#437). */
export function SeriesBanner(props: {
	games: readonly GameResult[];
	/** What the banner offers next to the score (a new series in the quick draft). */
	action?: ReactNode;
}) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const first = props.games[0];
	const last = props.games.at(-1);
	if (!first || !last) return null;
	const winsOf = (team: string) =>
		props.games.filter((game) => game.winner === team).length;
	return (
		<Victory
			label={t("draft.result.series.winner")}
			title={t("draft.result.victory", {
				team: teamName(options, last.winner),
			})}
			side={last.winner === last.blue ? "blue" : "red"}
			crest={<Crest team={last.winner} className="h-12 w-16" />}
		>
			<div className="flex items-center gap-6">
				<p className="font-bold">
					{teamName(options, first.blue)}{" "}
					<strong className="mx-2 font-display text-[28px]">
						{winsOf(first.blue)} – {winsOf(first.red)}
					</strong>{" "}
					{teamName(options, first.red)}
				</p>
				{props.action}
			</div>
		</Victory>
	);
}

function Mvp(props: {
	mvp: NonNullable<SeriesSummary["mvp"]>;
	games: readonly GameResult[];
	sideOf: (team: string) => "blue" | "red";
}) {
	const { t, i18n } = useTranslation();
	const options = useSeriesOptions();
	const { mvp } = props;
	const player = playerProfile(options, mvp.player);
	const role = props.games[0]?.lines.find((l) => l.player === mvp.player)?.role;
	const name = teamName(options, mvp.team);
	const champion = mostPlayed(props.games, mvp.player);
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
			className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 border-t-[3px] bg-panel px-5 py-2 ${props.sideOf(mvp.team) === "blue" ? "border-side-blue" : "border-side-red"}`}
		>
			<div className="flex items-end gap-1.5">
				<PlayerPortrait id={mvp.player} handle={player?.handle ?? mvp.player} />
				{champion && (
					<span className="size-12 shrink-0 border border-line bg-panel">
						<ChampionPortrait
							id={champion}
							label={championLabel(options, champion)}
							size="tile"
						/>
					</span>
				)}
			</div>
			<div className="min-w-0">
				<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
					{t("draft.result.mvp.label")}
				</p>
				<h2 className="mt-2 flex items-baseline gap-2.5 font-bold font-display text-[28px] leading-none tracking-heading">
					{role && (
						<span className="flex self-center">
							<GameRoleIcon role={role} size={24} />
						</span>
					)}
					<CountryFlag country={player?.nationality} />
					{player?.handle ?? mvp.player}
				</h2>
				<p className="mt-1 text-[14px] text-muted">
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
				<p className="mt-1 text-[14px] text-muted">
					{t("draft.result.mvp.why", {
						share: percent(mvp.participation),
						team: name,
					})}
				</p>
			</div>
			<dl className="grid grid-cols-[repeat(3,auto)] gap-8 border-line border-l py-1 pl-8">
				{stats.map((stat) => (
					<div key={stat.label}>
						<dt className="text-[13px] text-muted">{stat.label}</dt>
						<dd className="whitespace-nowrap font-bold font-display text-[26px] leading-tight">
							{stat.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/** The decisive dispute that weighed the most, as the core ranked them. */
function KeyMoment({ game }: { game: GameResult }) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const event = game.disputes[0];
	if (!event) return <span className="text-muted">–</span>;
	const text = t(`draft.result.event.${event.kind}`, {
		team: teamName(options, game[event.side]),
	});
	// Inline flow: the text follows the time and wraps under it, whole (#536).
	return (
		<span className="block text-[13px] leading-[15px] [overflow-wrap:anywhere]">
			<time className="mr-1.5 font-bold text-action">
				{clock(event.minute * 60 + event.second)}
			</time>
			{isObjectiveKind(event.kind) && (
				<span className="mr-1.5 inline-flex align-text-bottom">
					<MapIcon kind={event.kind} size="size-4" />
				</span>
			)}
			{text}
		</span>
	);
}

/** Map by map: the winner with its logo, the running score, the key moment and the length. */
function Recap(props: {
	games: readonly GameResult[];
	teamA: string;
	onOpen: (game: number) => void;
}) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const { games, teamA } = props;
	const teamB =
		games[0]?.blue === teamA ? games[0].red : (games[0]?.blue ?? "");
	let winsA = 0;
	let winsB = 0;
	const cell = "px-1.5 py-0.5";
	return (
		<section className="bg-panel px-4 py-2">
			<h2 className="font-bold font-display text-[19px] leading-tight tracking-heading">
				{t("draft.result.recap.title")}
			</h2>
			<table
				aria-label={t("draft.result.recap.name")}
				className="mt-1 w-full table-fixed text-[14px] leading-5 tabular-nums"
			>
				<thead className="text-left text-muted">
					<tr>
						<th scope="col" className={`w-12 font-normal ${cell}`}>
							{t("draft.result.recap.map")}
						</th>
						<th scope="col" className={`w-[24%] font-normal ${cell}`}>
							{t("draft.result.recap.winner")}
						</th>
						<th scope="col" className={`w-16 font-normal ${cell}`}>
							{t("draft.result.recap.score")}
						</th>
						<th scope="col" className={`font-normal ${cell}`}>
							{t("draft.result.recap.moment")}
						</th>
						<th scope="col" className={`w-14 font-normal ${cell}`}>
							{t("draft.result.recap.duration")}
						</th>
						<th scope="col" className="w-12 px-1.5 py-1">
							<span className="sr-only">{t("draft.result.recap.open")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{games.map((game) => {
						if (game.winner === teamA) winsA += 1;
						else winsB += 1;
						const winner = teamName(options, game.winner);
						return (
							<tr key={game.game} className="border-line border-t">
								<th scope="row" className={`text-left ${cell}`}>
									{game.game}
								</th>
								<td className={cell}>
									<span className="flex min-w-0 items-center gap-2">
										<Crest team={game.winner} className="h-5 w-7" />
										<Tooltip content={winner}>
											<span className="min-w-0 truncate font-bold">
												{winner}
											</span>
										</Tooltip>
									</span>
								</td>
								<td className={`font-bold ${cell}`}>
									<span className="sr-only">
										{t("draft.result.recap.scoreOf", {
											a: teamName(options, teamA),
											b: teamName(options, teamB),
										})}
									</span>
									{winsA} – {winsB}
								</td>
								<td className="px-1.5 py-0.5">
									<KeyMoment game={game} />
								</td>
								<td className={`text-muted ${cell}`}>{clock(game.duration)}</td>
								<td className="px-1 py-0.5 text-right">
									<Button
										variant="ghost"
										aria-label={t("draft.result.recap.view", {
											game: game.game,
										})}
										onClick={() => props.onOpen(game.game)}
									>
										{t("draft.result.recap.viewShort")}
									</Button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}

/** The "Full series" tab: the MVP above, then the map-by-map recap and the mean differences by role. */
export function SeriesReport(props: {
	games: readonly GameResult[];
	summary: SeriesSummary | undefined;
	onOpen: (game: number) => void;
}) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const teamA = props.games[0]?.blue ?? "";
	const sideOf = (team: string) => (team === teamA ? "blue" : "red");
	return (
		<div className="grid min-w-0 gap-3">
			{props.summary?.mvp && (
				<Mvp mvp={props.summary.mvp} games={props.games} sideOf={sideOf} />
			)}
			<div className="grid grid-cols-2 items-stretch gap-3">
				<Recap games={props.games} teamA={teamA} onOpen={props.onOpen} />
				<GapsTable
					gaps={gapsOfSeries(props.games, props.summary)}
					options={options}
					sideOf={sideOf}
					name={t("draft.result.gaps.name")}
					note={t("draft.result.gaps.average")}
				/>
			</div>
		</div>
	);
}
