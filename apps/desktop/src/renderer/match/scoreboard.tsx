import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../draft/team-crest";
import { clockTime } from "./playback";

export const sides = ["blue", "red"] as const;
export type TeamNames = Record<Side, string>;

function useGoldFormat() {
	const { i18n } = useTranslation();
	return useMemo(
		() => new Intl.NumberFormat(i18n.language, { useGrouping: true }),
		[i18n.language],
	);
}

export function TeamTotals({
	snapshot,
	names,
	ids,
}: {
	snapshot: MapSnapshot;
	names: TeamNames;
	ids: TeamNames;
}) {
	const { t } = useTranslation();
	const format = useGoldFormat();
	return (
		<div className="match-totals">
			{sides.map((side) => (
				<article
					key={side}
					aria-label={names[side]}
					data-side={side}
					className="match-team"
				>
					<TeamCrest id={ids[side]} name={names[side]} />
					<div>
						<h2>{names[side]}</h2>
						<p>
							{t("draft.match.gold", {
								amount: format.format(snapshot[side].gold),
							})}
						</p>
					</div>
					<div className="match-kills">
						<b>{snapshot[side].kills}</b>
						<p>{t("draft.match.kills")}</p>
					</div>
				</article>
			))}
		</div>
	);
}

export function GoldChart({
	snapshots,
	index,
	names,
	duration,
}: {
	snapshots: MapSnapshot[];
	index: number;
	names: TeamNames;
	duration: number;
}) {
	const { t } = useTranslation();
	const format = useGoldFormat();
	const chart = useMemo(() => {
		const visible = snapshots.slice(0, index + 1);
		const leads = visible.map((s) => s.blue.gold - s.red.gold);
		const peak = Math.max(1, ...leads.map(Math.abs));
		const lastSecond = Math.min(index * 60, duration);
		const path = leads
			.map((lead, i) => {
				const x = (600 * Math.min(i * 60, duration)) / Math.max(lastSecond, 1);
				return `${x} ${50 - (45 * lead) / peak}`;
			})
			.join(" L");
		return { path: `M${path}`, lastSecond, lead: leads.at(-1) ?? 0 };
	}, [snapshots, index, duration]);
	const leader = chart.lead < 0 ? "red" : "blue";
	const label = t("draft.match.lead", { team: names[leader] });
	const amount =
		chart.lead === 0
			? t("draft.match.even")
			: t("draft.match.moreGold", {
					amount: format.format(Math.abs(chart.lead)),
				});
	return (
		<figure className="match-chart">
			<figcaption>
				<span>{label}</span>
				<strong data-side={leader}>{amount}</strong>
			</figcaption>
			<svg
				viewBox="0 0 600 100"
				preserveAspectRatio="none"
				role="img"
				aria-label={t("draft.match.chart", {
					blue: names.blue,
					red: names.red,
					lead: amount,
				})}
			>
				<path
					d="M0 12H600 M0 50H600 M0 88H600"
					fill="none"
					stroke="var(--color-line)"
					strokeDasharray="3 5"
				/>
				<svg
					aria-hidden="true"
					viewBox="0 0 600 50"
					width="600"
					height="50"
					preserveAspectRatio="none"
					color="var(--color-side-blue)"
				>
					<ChartLine path={chart.path} />
				</svg>
				<svg
					aria-hidden="true"
					y="50"
					viewBox="0 50 600 50"
					width="600"
					height="50"
					preserveAspectRatio="none"
					color="var(--color-side-red)"
				>
					<ChartLine path={chart.path} />
				</svg>
			</svg>
			<div className="match-axis">
				{[0, 1, 2, 3].map((n) => (
					<span key={n}>
						{clockTime(Math.floor((chart.lastSecond * n) / 3))}
					</span>
				))}
			</div>
		</figure>
	);
}

function ChartLine({ path }: { path: string }) {
	return (
		<>
			<path d={`${path} V50 H0 Z`} fill="currentColor" opacity=".16" />
			<path
				d={path}
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				vectorEffect="non-scaling-stroke"
				strokeLinejoin="round"
			/>
		</>
	);
}
