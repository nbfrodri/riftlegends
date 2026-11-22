import type { SeriesSummary } from "@rift-legends/contracts";
import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import {
	clock,
	type GameResult,
	gapsOfGame,
	percent,
	topCauses,
} from "./result-data";
import { GapsTable } from "./result-gaps";
import {
	championLabel,
	playerHandle,
	teamName,
	useDraftSession,
} from "./session";

/** Banner with the winner's name, as in the approved mockup. */
export function Victory(props: {
	label: string;
	title: string;
	side: "blue" | "red";
	children?: React.ReactNode;
}) {
	return (
		<section
			className={`flex items-center justify-between gap-4 border-t-[3px] bg-panel px-6 py-2 ${props.side === "blue" ? "border-side-blue" : "border-side-red"}`}
		>
			<div>
				<p className="mb-1 font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
					{props.label}
				</p>
				<h2
					className={`font-bold font-display text-[32px] leading-none tracking-heading short:text-[28px] ${props.side === "blue" ? "text-side-blue" : "text-side-red"}`}
				>
					{props.title}
				</h2>
			</div>
			{props.children}
		</section>
	);
}

function Stats({
	game,
	showWinner,
}: {
	game: GameResult;
	showWinner: boolean;
}) {
	const { t, i18n } = useTranslation();
	const { options } = useDraftSession();
	const grouped = new Intl.NumberFormat(i18n.language);
	const headers = [
		"player",
		"champion",
		"kda",
		"gold",
		"damage",
		"share",
	] as const;
	return (
		<section className="bg-panel px-4 py-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
					{t("draft.result.game.label", {
						game: game.game,
						duration: clock(game.duration),
						blue: game.kills.blue,
						red: game.kills.red,
					})}
				</p>
				{showWinner && (
					<h2 className="font-bold font-display text-[19px] tracking-heading">
						{t("draft.result.victory", {
							team: teamName(options, game.winner),
						})}
					</h2>
				)}
			</div>
			<table
				aria-label={t("draft.result.stats.name", { game: game.game })}
				className="mt-2 w-full text-[14px] tabular-nums"
			>
				<thead className="bg-surface text-[13px] text-muted">
					<tr>
						{headers.map((key, i) => (
							<th
								key={key}
								scope="col"
								className={`whitespace-nowrap px-1.5 py-1 font-normal ${i < 2 ? "text-left" : "text-right"}`}
							>
								{t(`draft.result.stats.${key}`)}
							</th>
						))}
						<th scope="col" className="px-1.5 py-1 text-right font-normal">
							{t("draft.result.stats.rating")}
						</th>
					</tr>
				</thead>
				<tbody>
					{game.lines.map((line, i) => (
						<tr
							key={line.player}
							className={`border-line border-b ${i === 5 ? "border-t-2 border-t-muted" : ""}`}
						>
							<th scope="row" className="px-1.5 py-1 text-left font-semibold">
								<span
									className={`flex items-center gap-1.5 whitespace-nowrap ${line.side === "blue" ? "text-side-blue" : "text-side-red"}`}
								>
									<GameRoleIcon role={line.role} size={16} />
									<span title={t(`draft.roles.role.${line.role}`)}>
										{playerHandle(options, line.player)}
									</span>
								</span>
							</th>
							<td className="w-1/4 max-w-0 px-1.5 py-1 text-left">
								<span className="flex items-center gap-1.5">
									<ChampionFace id={line.champion} size="compact" />
									<span className="truncate">
										{championLabel(options, line.champion)}
									</span>
								</span>
							</td>
							<td className="px-1.5 py-1 text-right">
								{line.kills}/{line.deaths}/{line.assists}
							</td>
							<td className="px-1.5 py-1 text-right">
								{grouped.format(line.gold)}
							</td>
							<td className="px-1.5 py-1 text-right">
								{grouped.format(line.damage)}
							</td>
							<td className="px-1.5 py-1 text-right">
								{t("draft.result.percent", {
									value: percent(line.participation),
								})}
							</td>
							<td className="px-1.5 py-1 text-right font-bold">
								{line.rating}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="mt-1.5 text-[12px] text-muted">
				{t("draft.result.stats.footnote")}
			</p>
		</section>
	);
}

/** Cause keys are the core's: a known one reads as a phrase, any other as it is. */
const causePhrase = (t: ReturnType<typeof useTranslation>["t"], key: string) =>
	t(`draft.result.cause.${key}` as "draft.result.cause.macro", {
		defaultValue: key,
	});

function Disputes({ game }: { game: GameResult }) {
	const { t, i18n } = useTranslation();
	const { options } = useDraftSession();
	const list = new Intl.ListFormat(i18n.language, {
		style: "long",
		type: "conjunction",
	});
	return (
		<section className="bg-panel px-4 py-3 short:py-2.5">
			<h2 className="font-bold font-display text-[19px] leading-tight tracking-heading">
				{t("draft.result.decisive.title")}
			</h2>
			<ol
				aria-label={t("draft.result.decisive.name")}
				className="mt-1 divide-y divide-line"
			>
				{game.disputes.map((event, i) => {
					const team = teamName(options, game[event.side]);
					const causes = topCauses(event).map((key) => causePhrase(t, key));
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: the core's order is the identity
						<li key={i} className="flex gap-3 py-1.5 leading-5 short:py-1">
							<time className="w-15 shrink-0 font-bold font-display text-action tabular-nums">
								{clock(event.minute * 60 + event.second)}
							</time>
							<div>
								<h3 className="font-semibold">
									{t(`draft.result.event.${event.kind}`, { team })}
								</h3>
								{causes.length > 0 && (
									<p className="mt-0.5 text-[13px] text-muted leading-[18px]">
										{t("draft.result.because", {
											team,
											causes: list.format(causes),
										})}
									</p>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}

/** One played game: stats of the ten players, differences by role and the decisive disputes. */
export function GameReport(props: {
	game: GameResult;
	summary: SeriesSummary | undefined;
	/** Name the winner in the stats panel; the game's own banner already does it. */
	showWinner: boolean;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const { game } = props;
	return (
		<div className="grid min-w-0 grid-cols-2 items-start gap-3">
			<Stats game={game} showWinner={props.showWinner} />
			<div className="grid gap-3">
				<GapsTable
					gaps={gapsOfGame(game, props.summary)}
					options={options}
					sideOf={(team) => (team === game.blue ? "blue" : "red")}
					name={t("draft.result.gaps.name")}
				/>
				<Disputes game={game} />
			</div>
		</div>
	);
}
