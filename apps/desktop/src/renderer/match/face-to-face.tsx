import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
import { PlayerPortrait } from "../draft/board/player-card";
import { ChampionPortrait } from "../draft/champion-portrait";
import { panel, panelTable, panelTitle } from "./classes";
import { type TeamNames, useGoldDiff, useGoldFormat } from "./scoreboard";

const roles = ["top", "jungle", "mid", "bot", "support"] as const;
type Line = MapSnapshot["players"][number];

/** Who leads a number: a side, or null on a tie. */
const leader = (blue: number, red: number): Side | null =>
	blue === red ? null : blue > red ? "blue" : "red";

/** Gold and CS leads of one lane, with the neighbouring same-side leads merged. */
function leads(blue: Line, red: Line) {
	const gold = leader(blue.gold, red.gold);
	const cs = leader(blue.cs, red.cs);
	return [
		{ metric: "gold", side: gold, amount: Math.abs(blue.gold - red.gold) },
		{ metric: "cs", side: cs, amount: Math.abs(blue.cs - red.cs) },
	] as const;
}

function Ahead({
	blue,
	red,
	names,
}: {
	blue: Line;
	red: Line;
	names: TeamNames;
}) {
	const { t } = useTranslation();
	const format = useGoldFormat();
	const goldDiff = useGoldDiff();
	const text = {
		gold: goldDiff,
		cs: (amount: number) =>
			t("draft.match.faceToFace.moreCs", { amount: format.format(amount) }),
	};
	const [gold, cs] = leads(blue, red);
	if (!gold.side && !cs.side)
		return <span>{t("draft.match.faceToFace.even")}</span>;
	const segments =
		gold.side === cs.side
			? [{ side: gold.side, parts: [gold, cs] }]
			: [
					{ side: gold.side, parts: [gold] },
					{ side: cs.side, parts: [cs] },
				];
	return segments
		.filter((segment) => segment.side)
		.map((segment) => {
			const side = segment.side as Side;
			const parts = segment.parts.map((p) => text[p.metric](p.amount));
			return (
				<span
					key={side}
					data-side={side}
					className="block font-bold text-(--side)"
				>
					{t("draft.match.faceToFace.ahead", {
						team: names[side],
						what: parts.join(t("draft.match.faceToFace.and")),
					})}
				</span>
			);
		});
}

/** Half the bar is the biggest lead of the minute, and at least this much gold. */
const MIN_LEAD_SCALE = 1000;

/** The lane's gold lead as a bar from the centre towards the side ahead. */
function GoldLead({
	blue,
	red,
	scale,
}: {
	blue: Line;
	red: Line;
	scale: number;
}) {
	const side = leader(blue.gold, red.gold);
	const width = (50 * Math.abs(blue.gold - red.gold)) / scale;
	return (
		<span aria-hidden="true" className="relative block h-1.5 w-full bg-surface">
			<span className="absolute inset-y-[-2px] left-1/2 w-px bg-muted" />
			{side && (
				<span
					data-gold-lead
					data-side={side}
					className={`absolute inset-y-0 bg-(--side) ${side === "blue" ? "right-1/2" : "left-1/2"}`}
					style={{ width: `${width}%` }}
				/>
			)}
		</span>
	);
}

/** Who plays a lane: the player's handle and their champion. */
export interface LanePlayer {
	handle: string;
	champion: string;
	championName: string;
}

/** Lanes whose vision tells the most: their rows show it next to the name (#510). */
const visionRoles = new Set<string>(["jungle", "support"]);

/** The vision score with the scoreboard's eye; screen readers hear it in words. */
function VisionScore({ value }: { value: number }) {
	const { t } = useTranslation();
	return (
		<span className="inline-flex items-center gap-1">
			<StatIcon stat="vision" size={14} />
			{t("draft.match.faceToFace.vision", { value })}
		</span>
	);
}

/**
 * The player column's tracks, shared by its header and every row: photo,
 * the visible part of the champion badge, then the name. Fixed widths, so
 * the name starts at the same place whatever the font (#548).
 */
const playerTracks = {
	blue: "grid grid-cols-[38px_16px_minmax(0,1fr)] items-center",
	red: "grid grid-cols-[minmax(0,1fr)_16px_38px] items-center",
} as const;
/** The name sits next to the pictures: start-aligned, mirrored on red (#548). */
const nameAlign = {
	blue: "col-start-3 ml-1.5 text-left",
	red: "col-start-1 row-start-1 mr-1.5 text-right",
} as const;

/** «Player» header, aligned like the names below it (#548). */
function PlayerHeader({ side }: { side: Side }) {
	const { t } = useTranslation();
	return (
		<th scope="col" className="px-1!">
			<span className={playerTracks[side]}>
				<span className={`min-w-0 truncate ${nameAlign[side]}`}>
					{t("draft.match.faceToFace.player")}
				</span>
			</span>
		</th>
	);
}

/**
 * Photo, champion portrait and the name block, in fixed tracks with the
 * pictures on the outer edge: a long name is cut, it never moves them (#433).
 */
function Player({
	id,
	player,
	side,
	vision,
	showVision,
}: {
	id: string;
	player: LanePlayer | undefined;
	side: Side;
	/** The final vision score; unknown while the game plays. */
	vision: number | undefined;
	/** Show it in the row too, not only in the tooltip. */
	showVision: boolean;
}) {
	const { t } = useTranslation();
	const inRow = showVision && vision !== undefined;
	const parts = player && [
		<span key="photo" data-part="photo" className="flex">
			<PlayerPortrait id={id} handle={player.handle} size="h-12 w-[38px]" />
		</span>,
		// A 28 px champion badge over the photo's lower inner corner leaves the name more room (#450, #502).
		<span
			key="champion"
			data-part="champion"
			className={`relative flex self-end ring-2 ring-panel [&_[role=img]]:size-7 ${side === "blue" ? "-ml-3" : "-mr-3"}`}
		>
			<ChampionPortrait
				id={player.champion}
				label={player.championName}
				size="compact"
			/>
		</span>,
		<Tooltip
			key="name"
			heading={player.handle}
			content={player.championName}
			extra={vision === undefined ? undefined : <VisionScore value={vision} />}
		>
			<span data-part="name" className={`min-w-0 ${nameAlign[side]}`}>
				<span className="block truncate font-bold text-[15px] text-text">
					{player.handle}
				</span>
				{/* The vision score shares the champion's line: the row keeps its height (#510). */}
				<span
					aria-hidden="true"
					className={`flex min-w-0 items-center gap-1.5 truncate text-[12px] text-muted ${side === "blue" ? "justify-start" : "justify-end"}`}
				>
					<span className="truncate">{player.championName}</span>
					{inRow && (
						<span
							data-vision
							className="inline-flex shrink-0 items-center gap-0.5 font-bold text-text tabular-nums"
						>
							<StatIcon stat="vision" size={12} />
							{vision}
						</span>
					)}
				</span>
				{inRow && (
					<span className="sr-only">
						{t("draft.match.faceToFace.vision", { value: vision })}
					</span>
				)}
			</span>
		</Tooltip>,
	];
	return (
		<td data-side={side} className="px-1!">
			{parts && (
				<span data-lane-player className={playerTracks[side]}>
					{side === "blue" ? parts : parts.reverse()}
				</span>
			)}
		</td>
	);
}

const columns = ["kda", "cs", "gold"] as const;
/**
 * Stat cells: 8 px each side, so neighbouring columns stay 16 px apart (#450).
 * Header and figures start at the same edge, the player's side (#548).
 */
const stat = {
	blue: "px-2! tabular-nums text-left!",
	red: "px-2! tabular-nums text-right!",
} as const;
/**
 * A body number: 15 px in the normal text colour, like every other figure
 * (#502). Flex keeps its start edge even when a wide number overflows the
 * column: the overflow goes towards the lane, never past the header (#548).
 */
function Figure({
	side,
	bold = false,
	children,
}: {
	side: Side;
	bold?: boolean;
	children: ReactNode;
}) {
	return (
		<td
			className={`${stat[side]} text-[15px] text-text ${bold ? "font-bold" : ""}`}
		>
			<span
				className={`flex whitespace-nowrap ${side === "blue" ? "justify-start" : "justify-end"}`}
			>
				{children}
			</span>
		</td>
	);
}

function Kda({ line, side }: { line: Line; side: Side }) {
	return (
		<Figure side={side} bold>
			{line.kills}/{line.deaths}/{line.assists}
		</Figure>
	);
}

function StatHeader({
	column,
	side,
}: {
	column: (typeof columns)[number];
	side: Side;
}) {
	const { t } = useTranslation();
	return (
		// Icon over label with a 4 px gap (#509), on the same edge as the figures (#548).
		<th scope="col" className={`py-1! ${stat[side]}`}>
			<span
				className={`flex flex-col gap-1 ${side === "blue" ? "items-start" : "items-end"}`}
			>
				<StatIcon stat={column} size={18} />
				{t(`draft.match.faceToFace.${column}`)}
			</span>
		</th>
	);
}

/** A gold lead in one line, in the leader's colour; the full reading is for screen readers. */
function LeadText({
	blue,
	red,
	names,
}: {
	blue: Line;
	red: Line;
	names: TeamNames;
}) {
	const { t } = useTranslation();
	const goldDiff = useGoldDiff();
	const side = leader(blue.gold, red.gold);
	const even = t("draft.match.faceToFace.even");
	if (!side && blue.cs === red.cs)
		return (
			<small className="block font-bold text-[11px] text-muted leading-none">
				{even}
			</small>
		);
	return (
		<small className="block truncate font-bold text-[11px] leading-none">
			<span
				aria-hidden="true"
				data-side={side ?? undefined}
				className={side ? "text-(--side)" : "text-muted"}
			>
				{side ? goldDiff(Math.abs(blue.gold - red.gold)) : even}
			</span>
			<span className="sr-only">
				<Ahead blue={blue} red={red} names={names} />
			</span>
		</small>
	);
}

/** Lane by lane, blue's player on the left and red's on the right, mirrored around the role. */
export function FaceToFace({
	snapshot,
	names,
	lineup,
	vision,
}: {
	snapshot: MapSnapshot;
	lineup: ReadonlyMap<string, LanePlayer>;
	names: TeamNames;
	/** Each player's final vision score, once the game is over (`match.ended`). */
	vision?: ReadonlyMap<string, number> | undefined;
}) {
	const { t } = useTranslation();
	const format = useGoldFormat();
	const lines = roles.flatMap((role, i) => {
		const blue = snapshot.players[i];
		const red = snapshot.players[i + roles.length];
		return blue && red ? [{ role, blue, red }] : [];
	});
	const scale = Math.max(
		MIN_LEAD_SCALE,
		...lines.map(({ blue, red }) => Math.abs(blue.gold - red.gold)),
	);
	return (
		<section className={`${panel} h-full`}>
			<h2 className={panelTitle}>{t("draft.match.faceToFace")}</h2>
			<table aria-label={t("draft.match.faceToFace")} className={panelTable}>
				{/* Fixed stat columns, 16 px apart (#450); the players take the rest. */}
				<colgroup>
					<col />
					<col className="w-[66px]" />
					<col className="w-[44px]" />
					<col className="w-[60px]" />
					<col className="w-[80px]" />
					<col className="w-[60px]" />
					<col className="w-[44px]" />
					<col className="w-[66px]" />
					<col />
				</colgroup>
				<thead>
					<tr>
						<th
							scope="colgroup"
							data-side="blue"
							colSpan={4}
							className="py-0.5!"
						>
							{names.blue}
						</th>
						<td />
						<th
							scope="colgroup"
							data-side="red"
							colSpan={4}
							className="py-0.5!"
						>
							{names.red}
						</th>
					</tr>
					<tr className="text-[12px]">
						<PlayerHeader side="blue" />
						{columns.map((column) => (
							<StatHeader key={column} column={column} side="blue" />
						))}
						<th scope="col">{t("draft.match.lane")}</th>
						{[...columns].reverse().map((column) => (
							<StatHeader key={column} column={column} side="red" />
						))}
						<PlayerHeader side="red" />
					</tr>
				</thead>
				<tbody>
					{lines.map(({ role, blue, red }) => (
						// Rows grow with the window, from 56 px at 1280×720 (#502).
						<tr key={role} className="h-[clamp(56px,8.4vh,72px)] [&>*]:py-0.5!">
							<Player
								id={blue.player}
								player={lineup.get(blue.player)}
								side="blue"
								vision={vision?.get(blue.player)}
								showVision={visionRoles.has(role)}
							/>
							<Kda line={blue} side="blue" />
							<Figure side="blue">{blue.cs}</Figure>
							<Figure side="blue">{format.format(blue.gold)}</Figure>
							<th scope="row">
								<span className="flex flex-col items-center gap-1.5">
									<span className="inline-flex items-center gap-1.5">
										<GameRoleIcon role={role} size={16} />
										{t(`draft.roles.role.${role}`)}
									</span>
									<GoldLead blue={blue} red={red} scale={scale} />
									<LeadText blue={blue} red={red} names={names} />
								</span>
							</th>
							<Figure side="red">{format.format(red.gold)}</Figure>
							<Figure side="red">{red.cs}</Figure>
							<Kda line={red} side="red" />
							<Player
								id={red.player}
								player={lineup.get(red.player)}
								side="red"
								vision={vision?.get(red.player)}
								showVision={visionRoles.has(role)}
							/>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
