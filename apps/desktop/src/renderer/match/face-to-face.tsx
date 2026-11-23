import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
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
		<span
			aria-hidden="true"
			className="relative my-0.5 block h-1.5 w-full bg-surface"
		>
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

/** A player's champion and K/D/A, aligned to the outer edge of their side. */
function Player({
	line,
	side,
	champion,
}: {
	line: Line;
	side: Side;
	champion: string | undefined;
}) {
	return (
		<td
			data-side={side}
			className={`text-(--side) ${side === "blue" ? "text-left!" : "text-right!"}`}
		>
			{champion && <span className="block truncate text-xs">{champion}</span>}
			<span className="font-bold">
				{line.kills}/{line.deaths}/{line.assists}
			</span>
		</td>
	);
}

const columns = ["kda", "cs", "gold"] as const;

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

/** Lane by lane, blue's player on the left and red's on the right, mirrored around the role. */
export function FaceToFace({
	snapshot,
	names,
	championByPlayer,
}: {
	snapshot: MapSnapshot;
	championByPlayer: ReadonlyMap<string, string>;
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
					<col className="w-[15%]" />
					<col span={2} className="w-[9%]" />
					<col />
					<col span={2} className="w-[9%]" />
					<col className="w-[15%]" />
				</colgroup>
				<thead>
					<tr>
						<th scope="colgroup" data-side="blue" colSpan={3}>
							{names.blue}
						</th>
						<td />
						<th scope="colgroup" data-side="red" colSpan={3}>
							{names.red}
						</th>
					</tr>
					<tr className="text-[12px]">
						{columns.map((column) => (
							<StatHeader key={column} column={column} />
						))}
						<th scope="col">{t("draft.match.lane")}</th>
						{[...columns].reverse().map((column) => (
							<StatHeader key={column} column={column} />
						))}
					</tr>
				</thead>
				<tbody>
					{lines.map(({ role, blue, red }) => (
						<tr key={role}>
							<Player
								line={blue}
								side="blue"
								champion={championByPlayer.get(blue.player)}
							/>
							<td>{blue.cs}</td>
							<td>{format.format(blue.gold)}</td>
							<th scope="row" className="px-2!">
								<span className="inline-flex items-center gap-1.5">
									<GameRoleIcon role={role} size={16} />
									{t(`draft.roles.role.${role}`)}
								</span>
								<GoldLead blue={blue} red={red} scale={scale} />
								<small className="block font-normal text-[11px] text-muted leading-[1.15]">
									<Ahead blue={blue} red={red} names={names} />
								</small>
							</th>
							<td>{format.format(red.gold)}</td>
							<td>{red.cs}</td>
							<Player
								line={red}
								side="red"
								champion={championByPlayer.get(red.player)}
							/>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
