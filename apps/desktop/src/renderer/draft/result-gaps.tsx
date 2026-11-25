import type { Role, SeriesOptions } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
import { useGoldFormat } from "../match/scoreboard";
import { PlayerPortrait } from "./board/player-card";
import { ChampionPortrait } from "./champion-portrait";
import type { LanePlayer, RoleGap } from "./result-data";
import { championLabel, playerProfile, teamName } from "./session";

type Side = "blue" | "red";

const numbers = (language: string) =>
	new Intl.NumberFormat(language, { maximumFractionDigits: 1 });

const handleOf = (options: SeriesOptions, player: string) =>
	playerProfile(options, player)?.handle ?? player;

/** A full bar is the biggest lead of the table, and at least this much. */
const MIN_SCALE = { rating: 10, gold: 1000 };
/** Width of a full bar, in pixels; the amount follows its end. */
const BAR = 22;

/**
 * Photo (silhouette without one) with the champion as a badge on its inner
 * corner, then the handle in white: pictures on the outer edge, mirrored on
 * the right, as in the face-to-face (#433).
 */
function Player(props: {
	lane: LanePlayer;
	options: SeriesOptions;
	edge: "left" | "right";
}) {
	const handle = handleOf(props.options, props.lane.player);
	const champion = championLabel(props.options, props.lane.champion);
	const left = props.edge === "left";
	const parts = [
		<span key="photo" className="flex">
			<PlayerPortrait
				id={props.lane.player}
				handle={handle}
				size="h-[26px] w-5"
			/>
		</span>,
		<span
			key="champion"
			className={`relative flex self-end ring-2 ring-panel [&_[role=img]]:size-4 ${left ? "-ml-2" : "-mr-2"}`}
		>
			<ChampionPortrait
				id={props.lane.champion}
				label={champion}
				size="compact"
			/>
		</span>,
		<Tooltip key="name" heading={handle} content={champion}>
			<span
				className={`min-w-0 ${left ? "ml-1 text-left" : "mr-1 text-right"}`}
			>
				<span className="block truncate font-bold text-[11px] leading-[14px]">
					{handle}
				</span>
				<span
					aria-hidden="true"
					className="block truncate text-[11px] text-muted leading-[12px]"
				>
					{champion}
				</span>
			</span>
		</Tooltip>,
	];
	return (
		<td className="px-0.5 py-0">
			<span
				className={`grid items-center ${left ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto_auto]"}`}
			>
				{left ? parts : parts.reverse()}
			</span>
		</td>
	);
}

/**
 * One line of the centre: its icon in the middle and, on the leader's half, a
 * bar growing outwards with the amount, unsigned, at its end. A tie has no
 * bar and says so next to the icon. Screen readers hear `spoken` instead.
 */
function Lead(props: {
	metric: "rating" | "gold";
	icon: ReactNode;
	side: Side | null;
	/** Bar width, 0 to 100. */
	width: number;
	text: string;
	spoken: string;
}) {
	const { t } = useTranslation();
	const half = (side: Side) =>
		props.side === side ? (
			<span
				className={`flex min-w-0 items-center gap-1 ${side === "blue" ? "flex-row-reverse" : ""}`}
			>
				<span
					data-bar={props.metric}
					data-side={side}
					className="h-1.5 shrink-0 bg-(--side)"
					style={{
						width: (BAR * Math.max(8, Math.min(100, props.width))) / 100,
					}}
				/>
				<span
					aria-hidden="true"
					data-side={side}
					className="truncate font-bold text-(--side)"
				>
					{props.text}
				</span>
			</span>
		) : (
			<span />
		);
	return (
		<span className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1 leading-[13px]">
			{half("blue")}
			<span aria-hidden="true" className="flex justify-center">
				{props.icon}
			</span>
			{props.side ? (
				half("red")
			) : (
				<span aria-hidden="true" className="text-left text-muted">
					{t("draft.result.gaps.even")}
				</span>
			)}
			<span className="sr-only">{props.spoken}</span>
		</span>
	);
}

/**
 * The differences by role, mirrored as the face-to-face (#507): the first
 * team's player on the left and the second's on the right, each with their
 * rating; in the centre, the role and two bars, rating and gold, that grow
 * towards the side ahead. Amounts carry no sign; screen readers hear who
 * leads whom. The role with the biggest rating gap is highlighted; the gaps
 * over the core's threshold are named in the call-out.
 */
export function GapsTable(props: {
	gaps: readonly RoleGap[];
	options: SeriesOptions;
	/** Colour of a team: a side in a game, the first or second team in a series. */
	sideOf: (team: string) => Side;
	name: string;
	note?: string;
}) {
	const { t, i18n } = useTranslation();
	const format = numbers(i18n.language);
	const goldFormat = useGoldFormat();
	const roleLabel = (role: Role) => t(`draft.roles.role.${role}`);
	const flagged = props.gaps.filter((gap) => gap.gap);
	const roles = new Intl.ListFormat(i18n.language, {
		style: "long",
		type: "conjunction",
	}).format(flagged.map((gap) => roleLabel(gap.role)));
	const scale = {
		rating: Math.max(MIN_SCALE.rating, ...props.gaps.map((g) => g.points)),
		gold: Math.max(MIN_SCALE.gold, ...props.gaps.map((g) => Math.abs(g.gold))),
	};
	const biggest = props.gaps.reduce<RoleGap | undefined>(
		(best, gap) => (gap.points > (best?.points ?? 0) ? gap : best),
		undefined,
	);
	const [first, second] = props.gaps[0]?.players ?? [];
	const ratingHeader = (key: string) => (
		<th key={key} scope="col" className="px-0.5 text-center font-normal">
			{t("draft.result.gaps.rating")}
		</th>
	);
	const teamHeader = (lane: LanePlayer | undefined, align: string) =>
		lane && (
			<th
				scope="col"
				data-side={props.sideOf(lane.team)}
				className={`truncate px-1.5 font-bold text-(--side) ${align}`}
			>
				{teamName(props.options, lane.team)}
			</th>
		);

	return (
		<section className="bg-panel px-3 py-3 short:py-2 [&_[data-side=blue]]:[--side:var(--color-side-blue)] [&_[data-side=red]]:[--side:var(--color-side-red)]">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="whitespace-nowrap font-bold font-display text-[19px] leading-tight tracking-heading">
					{t("draft.result.gaps.title")}
				</h2>
				<strong
					className={`text-right text-[13px] ${flagged.length > 0 ? "text-action" : "text-muted"}`}
				>
					{flagged.length > 0
						? t("draft.result.gaps.call", { roles })
						: t("draft.result.gaps.none")}
				</strong>
			</div>
			{props.note && <p className="text-[12px] text-muted">{props.note}</p>}
			<table
				aria-label={props.name}
				className="mt-0.5 w-full table-fixed text-[13px] tabular-nums"
			>
				<colgroup>
					<col />
					<col className="w-9" />
					<col className="w-[194px]" />
					<col className="w-9" />
					<col />
				</colgroup>
				{/* Visually hidden to fit 1280×720: the rows mirror the page header (#507). */}
				<thead className="sr-only">
					<tr>
						{teamHeader(first, "text-left")}
						{ratingHeader("rating-first")}
						<th scope="col" className="text-center font-normal">
							{t("draft.result.gaps.difference")}
						</th>
						{ratingHeader("rating-second")}
						{teamHeader(second, "text-right")}
					</tr>
				</thead>
				<tbody>
					{props.gaps.map((gap) => {
						const [a, b] = gap.players;
						const handle = (lane: LanePlayer) =>
							handleOf(props.options, lane.player);
						const otherOf = (lane: LanePlayer) => (lane === a ? b : a);
						const sideOf = (lane: LanePlayer | null) =>
							lane ? props.sideOf(lane.team) : null;
						const ratingLeader =
							gap.team === null ? null : gap.team === a.team ? a : b;
						// The gold is the rating leader's (the first team's on a tie): positive if it has more.
						const goldBase = ratingLeader ?? a;
						const goldLeader =
							gap.gold === 0
								? null
								: gap.gold > 0
									? goldBase
									: otherOf(goldBase);
						const gold = goldFormat.format(Math.abs(gap.gold));
						const points = format.format(gap.points);
						const isBiggest = gap === biggest;
						return (
							<tr
								key={gap.role}
								data-role={gap.role}
								data-gap={gap.gap}
								data-biggest={isBiggest || undefined}
								className={`border-line border-t ${isBiggest ? "bg-surface outline outline-action -outline-offset-1" : ""}`}
							>
								<Player lane={a} options={props.options} edge="left" />
								<td
									className={`px-0.5 text-center text-[15px] ${ratingLeader === a ? "font-bold" : "text-muted"}`}
								>
									{format.format(a.rating)}
								</td>
								<th scope="row" className="px-1 py-0 font-normal text-[12px]">
									<span className="sr-only">
										{roleLabel(gap.role)}
										{isBiggest && `, ${t("draft.result.gaps.biggest")}`}
									</span>
									<span className="grid">
										<Lead
											metric="rating"
											icon={<GameRoleIcon role={gap.role} size={16} />}
											side={sideOf(ratingLeader)}
											width={(100 * gap.points) / scale.rating}
											text={t("draft.result.gaps.points", {
												count: gap.points,
												points,
											})}
											spoken={
												ratingLeader
													? t("draft.result.gaps.above", {
															count: gap.points,
															points,
															leader: handle(ratingLeader),
															other: handle(otherOf(ratingLeader)),
														})
													: t("draft.result.gaps.evenRating")
											}
										/>
										<Lead
											metric="gold"
											icon={<StatIcon stat="gold" size={12} />}
											side={sideOf(goldLeader)}
											width={(100 * Math.abs(gap.gold)) / scale.gold}
											text={t("draft.match.goldDiff", { amount: gold })}
											spoken={
												goldLeader
													? t("draft.result.gaps.moreGold", {
															amount: gold,
															leader: handle(goldLeader),
															other: handle(otherOf(goldLeader)),
														})
													: t("draft.result.gaps.evenGold")
											}
										/>
									</span>
								</th>
								<td
									className={`px-0.5 text-center text-[15px] ${ratingLeader === b ? "font-bold" : "text-muted"}`}
								>
									{format.format(b.rating)}
								</td>
								<Player lane={b} options={props.options} edge="right" />
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}
