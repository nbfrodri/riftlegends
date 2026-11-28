import type { BracketView } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";

export function BracketDraw({
	draw,
}: {
	draw: NonNullable<BracketView["draw"]>;
}) {
	const { t } = useTranslation();
	const tiers = new Map(draw.tiers.map(({ team, tier }) => [team, tier]));
	const matchups: [number, number][] = [];
	for (const [teamA, teamB] of draw.pairs) {
		const tierA = tiers.get(teamA);
		const tierB = tiers.get(teamB);
		if (tierA === undefined || tierB === undefined) continue;
		const a = Math.min(tierA, tierB);
		const b = Math.max(tierA, tierB);
		if (!matchups.some(([first, second]) => first === a && second === b))
			matchups.push([a, b]);
	}
	const rules = matchups
		.sort(([a, b], [c, d]) => a - c || b - d)
		.map(([a, b]) => t("competition.draw.tierMatchup", { a, b }));

	return (
		<div className="flex flex-col gap-0.5 text-muted text-xs">
			<p>
				{rules.length
					? t("competition.draw.summary", { rules: rules.join(", ") })
					: t("competition.draw.tiered")}
			</p>
			{draw.relaxed.map((rule) => (
				<p key={rule}>{t(`competition.draw.relaxed.${rule}`)}</p>
			))}
		</div>
	);
}
