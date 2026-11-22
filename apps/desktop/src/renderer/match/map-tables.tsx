import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { MapIcon } from "../assets/map-icon";
import { panel, panelTable, panelTitle } from "./classes";
import { clockTime } from "./playback";
import { sides, type TeamNames } from "./scoreboard";

type Props = { snapshot: MapSnapshot; second: number; names: TeamNames };
const lanes = ["top", "mid", "bot"] as const;
type Lane = (typeof lanes)[number];
const tiers = {
	blue: ["inhibitor", "base", "inner", "outer"],
	red: ["outer", "inner", "base", "inhibitor"],
} as const;
const level = { outer: 1, inner: 2, base: 3 };

function Defenses({
	map,
	side,
	lane,
	second,
}: {
	map: MapSnapshot[Side];
	side: Side;
	lane: Lane;
	second: number;
}) {
	const { t } = useTranslation();
	return tiers[side].map((tier) => {
		const inhibitor = tier === "inhibitor";
		const back = map.inhibitors[lane];
		const down = inhibitor ? back !== null : map.towers[lane] >= level[tier];
		const kind = inhibitor
			? down
				? "inhibitorDown"
				: "inhibitor"
			: down
				? "towerDown"
				: "tower";
		const label = t(`draft.match.${kind}`);
		return (
			<td
				key={tier}
				data-side={side}
				data-down={down}
				title={label}
				className={down ? "text-[#d8bd92]" : "text-(--side)"}
			>
				<MapIcon kind={kind} />
				<span className="sr-only">{label}</span>
				{inhibitor && back !== null && (
					<small className="ml-px text-[11px]">
						{clockTime(Math.max(0, back * 60 - second))}
					</small>
				)}
			</td>
		);
	});
}

function NexusTowers({ lost }: { lost: number }) {
	const { t } = useTranslation();
	return (
		<td colSpan={4} className="text-muted">
			<MapIcon kind={lost >= 1 ? "towerDown" : "tower"} />
			<MapIcon kind={lost >= 2 ? "towerDown" : "tower"} />{" "}
			{t("draft.match.standingCount", { count: 2 - lost })}
		</td>
	);
}

export function Structures({ snapshot, second, names }: Props) {
	const { t } = useTranslation();
	return (
		<section className={panel}>
			<div className="flex items-center justify-between gap-2">
				<h2 className={panelTitle}>{t("draft.match.structures")}</h2>
				<span className="flex gap-2.5 text-[12px] text-muted">
					<span>
						<MapIcon kind="tower" /> {t("draft.match.standing")}
					</span>
					<span>
						<MapIcon kind="towerDown" /> {t("draft.match.destroyed")}
					</span>
				</span>
			</div>
			<table aria-label={t("draft.match.structures")} className={panelTable}>
				<thead>
					<tr>
						<th colSpan={4} scope="colgroup" data-side="blue">
							{t("draft.match.teamBase", { team: names.blue })}
						</th>
						<td />
						<th colSpan={4} scope="colgroup" data-side="red">
							{t("draft.match.teamBase", { team: names.red })}
						</th>
					</tr>
					<tr>
						{tiers.blue.map((tier) => (
							<th scope="col" key={tier}>
								{t(`draft.match.column.${tier}`)}
							</th>
						))}
						<th scope="col">{t("draft.match.lane")}</th>
						{tiers.red.map((tier) => (
							<th scope="col" key={tier}>
								{t(`draft.match.column.${tier}`)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{lanes.map((lane) => (
						<tr key={lane}>
							<Defenses
								map={snapshot.blue}
								side="blue"
								lane={lane}
								second={second}
							/>
							<th scope="row">{t(`draft.match.zone.lane-${lane}`)}</th>
							<Defenses
								map={snapshot.red}
								side="red"
								lane={lane}
								second={second}
							/>
						</tr>
					))}
					<tr className="text-[13px]">
						<NexusTowers lost={snapshot.blue.nexusTowers} />
						<th scope="row">
							<MapIcon kind="nexus" />
							{t("draft.match.kind.nexus")}
						</th>
						<NexusTowers lost={snapshot.red.nexusTowers} />
					</tr>
				</tbody>
			</table>
			<p className="mt-1.5 text-[12px] text-muted">
				{t("draft.match.respawnNote")}
			</p>
		</section>
	);
}

const objectives = ["dragon", "herald", "baron", "elder"] as const;
export function Objectives({ snapshot, second, names }: Props) {
	const { t } = useTranslation();
	return (
		<section className={panel}>
			<h2 className={panelTitle}>{t("draft.match.objectives")}</h2>
			<table aria-label={t("draft.match.objectives")} className={panelTable}>
				<colgroup>
					<col style={{ width: "30%" }} />
				</colgroup>
				<colgroup span={2} />
				<colgroup span={2} />
				<thead>
					<tr>
						<th rowSpan={2} scope="col">
							{t("draft.match.objective")}
						</th>
						{sides.map((side) => (
							<th key={side} scope="colgroup" data-side={side} colSpan={2}>
								{names[side]}
							</th>
						))}
					</tr>
					<tr className="text-[12px]">
						{sides.map((side) => (
							<Fragment key={side}>
								<th scope="col">{t("draft.match.captures")}</th>
								<th scope="col">{t("draft.match.effect")}</th>
							</Fragment>
						))}
					</tr>
				</thead>
				<tbody>
					{objectives.map((kind) => (
						<tr key={kind}>
							<th scope="row" className="text-muted">
								<span className="m-auto flex max-w-[166px] items-center gap-[7px] text-left [&>:is(svg,img)]:flex-none">
									<MapIcon kind={kind} />
									{t(`draft.match.objective.${kind}`)}
								</span>
							</th>
							{sides.map((side) => {
								const map = snapshot[side];
								const until = kind === "dragon" ? null : map.buffs[kind];
								const progress = t("draft.match.dragonCount", {
									count: map.dragons,
								});
								const soul = map.soul
									? t("draft.match.soul")
									: t("draft.match.toSoul", { count: 4 - map.dragons });
								return (
									<Fragment key={side}>
										<td className="font-bold">
											{kind === "dragon" ? progress : map[`${kind}s`]}
										</td>
										<td
											className={
												until !== null || (kind === "dragon" && map.soul)
													? "font-bold text-action"
													: "text-muted"
											}
										>
											{kind === "dragon"
												? soul
												: until === null
													? t("draft.match.noEffect")
													: clockTime(Math.max(0, until * 60 - second))}
										</td>
									</Fragment>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
