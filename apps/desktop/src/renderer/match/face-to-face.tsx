import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
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

/** Portrait, handle and champion, with the portrait on the outer edge of the side. */
function Player({
	player,
	side,
}: {
	player: LanePlayer | undefined;
	side: Side;
}) {
	return (
		<td data-side={side}>
			{player && (
				<span
					className={`flex min-w-0 items-center gap-2 ${side === "blue" ? "text-left" : "flex-row-reverse text-right"}`}
				>
					<ChampionPortrait
						id={player.champion}
						label={player.championName}
						size="compact"
					/>
					<span className="min-w-0">
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
				</span>
			)}
		</td>
	);
}

const columns = ["kda", "cs", "gold"] as const;

function Kda({ line, side }: { line: Line; side: Side }) {
	return (
		<td data-side={side} className="font-bold text-(--side)">
			{line.kills}/{line.deaths}/{line.assists}
		</td>
	);
}

function StatHeader({ column }: { column: (typeof columns)[number] }) {
	const { t } = useTranslation();
	return (
		<th scope="col">
			<span className="inline-flex items-center gap-1">
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
				<colgroup>
					<col className="w-[18.5%]" />
					<col className="w-[9%]" />
					<col className="w-[6.5%]" />
					<col className="w-[9%]" />
					<col />
					<col className="w-[9%]" />
					<col className="w-[6.5%]" />
					<col className="w-[9%]" />
					<col className="w-[18.5%]" />
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
							<Player player={lineup.get(blue.player)} side="blue" />
							<Kda line={blue} side="blue" />
							<td>{blue.cs}</td>
							<td>{format.format(blue.gold)}</td>
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
							<td>{format.format(red.gold)}</td>
							<td>{red.cs}</td>
							<Kda line={red} side="red" />
							<Player player={lineup.get(red.player)} side="red" />
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
