import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
import { panel, panelTable, panelTitle } from "./classes";
import {
	sides,
	type TeamNames,
	useGoldDiff,
	useGoldFormat,
} from "./scoreboard";

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

function Numbers({
	line,
	side,
	champion,
}: {
	line: Line;
	side: Side;
	champion: string | undefined;
}) {
	const format = useGoldFormat();
	return (
		<>
			<td data-side={side} className="text-(--side)">
				{champion && <span className="block truncate text-xs">{champion}</span>}
				<span>
					{line.kills}/{line.deaths}/{line.assists}
				</span>
			</td>
			<td>{line.cs}</td>
			<td>{format.format(line.gold)}</td>
		</>
	);
}

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
	const columns = ["kda", "cs", "gold"] as const;
	return (
		<section className={`${panel} h-full`}>
			<h2 className={panelTitle}>{t("draft.match.faceToFace")}</h2>
			<table aria-label={t("draft.match.faceToFace")} className={panelTable}>
				<colgroup>
					<col style={{ width: "28%" }} />
				</colgroup>
				<thead>
					<tr>
						<th rowSpan={2} scope="col">
							{t("draft.match.lane")}
						</th>
						{sides.map((side) => (
							<th key={side} scope="colgroup" data-side={side} colSpan={3}>
								{names[side]}
							</th>
						))}
					</tr>
					<tr className="text-[12px]">
						{sides.map((side) => (
							<Fragment key={side}>
								{columns.map((column) => (
									<th scope="col" key={column}>
										<span className="inline-flex items-center gap-1">
											<StatIcon stat={column} size={12} />
											{t(`draft.match.faceToFace.${column}`)}
										</span>
									</th>
								))}
							</Fragment>
						))}
					</tr>
				</thead>
				<tbody>
					{roles.map((role, i) => {
						const blue = snapshot.players[i];
						const red = snapshot.players[i + roles.length];
						if (!blue || !red) return null;
						return (
							<tr key={role}>
								<th scope="row">
									<span className="flex flex-col items-center gap-px">
										<span className="inline-flex items-center gap-1.5">
											<GameRoleIcon role={role} size={16} />
											{t(`draft.roles.role.${role}`)}
										</span>
										<small className="font-normal text-[11px] text-muted leading-[1.2]">
											<Ahead blue={blue} red={red} names={names} />
										</small>
									</span>
								</th>
								<Numbers
									line={blue}
									side="blue"
									champion={championByPlayer.get(blue.player)}
								/>
								<Numbers
									line={red}
									side="red"
									champion={championByPlayer.get(red.player)}
								/>
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}
