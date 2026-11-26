import type { MapSnapshot, Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../draft/team-crest";

export const sides = ["blue", "red"] as const;
export type TeamNames = Record<Side, string>;

export function useGoldFormat() {
	const { i18n } = useTranslation();
	return useMemo(
		() => new Intl.NumberFormat(i18n.language, { useGrouping: true }),
		[i18n.language],
	);
}

/** A gold difference with its sign: "+300 gold", "−1,550 gold". */
export function useGoldDiff() {
	const { t } = useTranslation();
	const format = useGoldFormat();
	return (gold: number) =>
		t("draft.match.goldDiff", {
			amount: `${gold < 0 ? "−" : "+"}${format.format(Math.abs(gold))}`,
		});
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
		<div className="grid grid-cols-2 gap-3">
			{sides.map((side) => (
				<article
					key={side}
					aria-label={names[side]}
					data-side={side}
					className="flex min-w-0 items-center gap-2.5 border-(--side) border-t-[3px] bg-panel px-[clamp(9px,1.1vw,18px)] py-2.5 [&>svg]:h-auto [&>svg]:w-[clamp(28px,3vw,44px)] [&>svg]:flex-none [&>svg]:text-(--side)"
				>
					<TeamCrest id={ids[side]} name={names[side]} />
					<div className="min-w-0">
						{/* #572: long names stay on one line; the tooltip reads them whole. */}
						<Tooltip content={names[side]}>
							<h2 className="truncate font-bold font-display text-[clamp(19px,1.9vw,30px)] leading-[1.1] tracking-[-0.045em]">
								{names[side]}
							</h2>
						</Tooltip>
						<p className="text-[13px] text-muted">
							{t("draft.match.gold", {
								amount: format.format(snapshot[side].gold),
							})}
						</p>
					</div>
					<div className="ml-auto text-right">
						<b className="block text-[clamp(31px,3vw,42px)] leading-none">
							{snapshot[side].kills}
						</b>
						<p className="text-[13px] text-muted">{t("draft.match.kills")}</p>
					</div>
				</article>
			))}
		</div>
	);
}
