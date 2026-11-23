import type { MapSnapshot } from "@rift-legends/contracts";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { clockTime } from "./playback";
import { type TeamNames, useGoldDiff, useGoldFormat } from "./scoreboard";

/** The smallest half-height of the chart, so an early 100 gold lead stays small. */
const MIN_RANGE = 2000;
const STEP = 1000;

/** Gold shown from the zero line to each edge: the biggest lead, rounded up to a thousand. */
export function goldRange(leads: readonly number[]) {
	const peak = Math.max(0, ...leads.map(Math.abs));
	return Math.max(MIN_RANGE, Math.ceil(peak / STEP) * STEP);
}

// Blue's lead goes up, red's goes down; the zero line sits at y = 50.
const WIDTH = 600;
const ZERO = 50;

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
	const goldDiff = useGoldDiff();
	const format = useGoldFormat();
	const id = useId();
	const chart = useMemo(() => {
		const leads = snapshots
			.slice(0, index + 1)
			.map((s) => s.blue.gold - s.red.gold);
		const range = goldRange(leads);
		const lastSecond = Math.min(index * 60, duration);
		const points = leads.map((lead, i) => {
			const x = (WIDTH * Math.min(i * 60, duration)) / Math.max(lastSecond, 1);
			return `${x} ${ZERO - (ZERO * lead) / range}`;
		});
		const line = `M${points.join(" L")}`;
		return {
			line,
			area: `${line} V${ZERO} H0 Z`,
			range,
			lastSecond,
			lead: leads.at(-1) ?? 0,
		};
	}, [snapshots, index, duration]);
	const leader = chart.lead < 0 ? "red" : "blue";
	const amount =
		chart.lead === 0 ? t("draft.match.even") : goldDiff(Math.abs(chart.lead));
	const halves = [
		{ side: "blue", y: 0 },
		{ side: "red", y: ZERO },
	] as const;
	return (
		<figure className="flex h-full min-w-0 flex-col bg-panel px-3.5 py-[9px]">
			<figcaption className="flex items-center justify-between gap-2 font-bold text-[13px]">
				<span>{t("draft.match.lead", { team: names[leader] })}</span>
				<strong
					data-side={leader}
					className="text-(--side) text-[clamp(15px,1.4vw,21px)]"
				>
					{amount}
				</strong>
			</figcaption>
			<div className="mt-1 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1">
				<svg
					viewBox={`0 0 ${WIDTH} 100`}
					preserveAspectRatio="none"
					role="img"
					className="h-full min-h-5 w-full"
					aria-label={t("draft.match.chart", {
						blue: names.blue,
						red: names.red,
						lead: amount,
					})}
				>
					<defs>
						{halves.map(({ side, y }) => (
							<clipPath key={side} id={`${id}-${side}`}>
								<rect y={y} width={WIDTH} height={ZERO} />
							</clipPath>
						))}
					</defs>
					<path
						d={`M0 25H${WIDTH} M0 75H${WIDTH}`}
						fill="none"
						stroke="var(--color-line)"
						strokeDasharray="3 5"
						vectorEffect="non-scaling-stroke"
					/>
					{halves.map(({ side }) => (
						<g
							key={side}
							clipPath={`url(#${id}-${side})`}
							color={`var(--color-side-${side})`}
						>
							<path d={chart.area} fill="currentColor" opacity=".3" />
							<path
								data-lead-line={side === "blue" ? "" : undefined}
								d={chart.line}
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								vectorEffect="non-scaling-stroke"
								strokeLinejoin="round"
							/>
						</g>
					))}
					<path
						d={`M0 ${ZERO}H${WIDTH}`}
						stroke="var(--color-muted)"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				<div
					aria-hidden="true"
					className="flex flex-col justify-between text-right text-[11px] leading-none"
				>
					<span data-axis data-side="blue" className="text-(--side)">
						{format.format(chart.range)}
					</span>
					<span data-axis className="text-muted">
						0
					</span>
					<span data-axis data-side="red" className="text-(--side)">
						{format.format(chart.range)}
					</span>
				</div>
				<div className="flex items-center justify-between gap-2 text-[11px] text-muted">
					{[0, 1, 2, 3].map((n) => (
						<span key={n}>
							{clockTime(Math.floor((chart.lastSecond * n) / 3))}
						</span>
					))}
				</div>
			</div>
		</figure>
	);
}
