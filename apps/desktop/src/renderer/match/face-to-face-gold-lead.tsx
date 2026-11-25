import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { type TeamNames, useGoldDiff, useGoldFormat } from "./scoreboard";

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
export const MIN_LEAD_SCALE = 1000;

/** The lane's gold lead as a bar from the centre towards the side ahead. */
export function GoldLead({
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

/** A gold lead in one line, in the leader's colour; the full reading is for screen readers. */
export function LeadText({
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
