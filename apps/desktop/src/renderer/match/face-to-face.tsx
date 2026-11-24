import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
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

/**
 * Photo, champion portrait and the name block, in fixed tracks with the
 * pictures on the outer edge: a long name is cut, it never moves them (#433).
 */
function Player({
	id,
	player,
	side,
}: {
	id: string;
	player: LanePlayer | undefined;
	side: Side;
}) {
	const parts = player && [
		<span key="photo" data-part="photo" className="flex">
			<PlayerPortrait id={id} handle={player.handle} size="h-8 w-[26px]" />
		</span>,
		// A 20 px champion badge over the photo's lower inner corner leaves the name more room (#450).
		<span
			key="champion"
			data-part="champion"
			className={`relative flex self-end ring-2 ring-panel [&_[role=img]]:size-5 ${side === "blue" ? "-ml-2" : "-mr-2"}`}
		>
			<ChampionPortrait
				id={player.champion}
				label={player.championName}
				size="compact"
			/>
		</span>,
		<Tooltip key="name" heading={player.handle} content={player.championName}>
			<span
				data-part="name"
				className={`min-w-0 text-center ${side === "blue" ? "ml-1.5" : "mr-1.5"}`}
			>
				<span className="block truncate font-bold text-(--side)">
					{player.handle}
				</span>
				<span
					aria-hidden="true"
					className="block truncate text-[11px] text-muted"
				>
					{player.championName}
				</span>
			</span>
		</Tooltip>,
	];
	return (
		<td data-side={side} className="px-1!">
			{parts && (
				<span
					data-lane-player
					className={`grid items-center ${side === "blue" ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto_auto]"}`}
				>
					{side === "blue" ? parts : parts.reverse()}
				</span>
			)}
		</td>
	);
}

const columns = ["kda", "cs", "gold"] as const;
/** Stat cells: 8 px each side, so neighbouring columns stay 16 px apart (#450). */
const stat = "px-2! tabular-nums";

function Kda({ line, side }: { line: Line; side: Side }) {
	return (
		<td data-side={side} className={`font-bold text-(--side) ${stat}`}>
			{line.kills}/{line.deaths}/{line.assists}
		</td>
	);
}

function StatHeader({ column }: { column: (typeof columns)[number] }) {
	const { t } = useTranslation();
	return (
		// Icon over label: narrow headers; tight padding keeps the row low.
		<th scope="col" className={`py-0.5! ${stat}`}>
			<span className="inline-flex flex-col items-center gap-0.5">
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
}: {
	snapshot: MapSnapshot;
	lineup: ReadonlyMap<string, LanePlayer>;
	names: TeamNames;
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
					<col className="w-[62px]" />
					<col className="w-[42px]" />
					<col className="w-[56px]" />
					<col className="w-[84px]" />
					<col className="w-[56px]" />
					<col className="w-[42px]" />
					<col className="w-[62px]" />
					<col />
				</colgroup>
				<thead>
					<tr>
						<th scope="colgroup" data-side="blue" colSpan={4}>
							{names.blue}
						</th>
						<td />
						<th scope="colgroup" data-side="red" colSpan={4}>
							{names.red}
						</th>
					</tr>
					<tr className="text-[12px]">
						<th scope="col">{t("draft.match.faceToFace.player")}</th>
						{columns.map((column) => (
							<StatHeader key={column} column={column} />
						))}
						<th scope="col">{t("draft.match.lane")}</th>
						{[...columns].reverse().map((column) => (
							<StatHeader key={column} column={column} />
						))}
						<th scope="col">{t("draft.match.faceToFace.player")}</th>
					</tr>
				</thead>
				<tbody>
					{lines.map(({ role, blue, red }) => (
						<tr key={role}>
							<Player
								id={blue.player}
								player={lineup.get(blue.player)}
								side="blue"
							/>
							<Kda line={blue} side="blue" />
							<td className={stat}>{blue.cs}</td>
							<td className={stat}>{format.format(blue.gold)}</td>
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
							<td className={stat}>{format.format(red.gold)}</td>
							<td className={stat}>{red.cs}</td>
							<Kda line={red} side="red" />
							<Player
								id={red.player}
								player={lineup.get(red.player)}
								side="red"
							/>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
