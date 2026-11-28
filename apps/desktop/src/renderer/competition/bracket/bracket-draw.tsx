import type { BracketView } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import type { TeamNames } from "./bracket-card";
import type { Label } from "./bracket-labels";

// The draw that ordered the first round of a bracket (#628): one sentence per
// pairing with the tier of both teams and, if a rule had to be relaxed, why.

export function BracketDraw({
	draw,
	round,
	team,
}: {
	draw: NonNullable<BracketView["draw"]>;
	/** The first round of the bracket, which the draw filled. */
	round: Label;
	team: (id: string) => TeamNames;
}) {
	const { t } = useTranslation();
	const tier = new Map(draw.tiers.map((entry) => [entry.team, entry.tier]));
	const title = t("competition.draw.title", {
		round: t(round.key, round.params),
	});
	return (
		<section
			aria-label={title}
			className="mb-3 flex flex-col gap-1 text-[13px]"
		>
			<h3 className="font-semibold text-[11px] text-text uppercase tracking-heading">
				{title}
			</h3>
			<ul className="grid grid-cols-[repeat(2,max-content)] gap-x-10 gap-y-0.5 text-muted">
				{draw.pairs.map(([a, b]) => (
					<li key={`${a}-${b}`}>
						{t("competition.draw.pair", {
							a: team(a).name,
							tierA: tier.get(a),
							b: team(b).name,
							tierB: tier.get(b),
						})}
					</li>
				))}
			</ul>
			{draw.relaxed.map((rule) => (
				<p key={rule} className="text-[12px] text-muted">
					{t(`competition.draw.relaxed.${rule}`)}
				</p>
			))}
		</section>
	);
}
