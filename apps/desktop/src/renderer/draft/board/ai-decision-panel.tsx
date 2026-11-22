import {
	draftFacts,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { ChevronRight } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFacts } from "../../core";
import { championLabel, teamName } from "../session";
import { InspectionPanel } from "./player-card";

type Decision = Extract<
	ReturnType<typeof draftFacts.schema.parse>,
	{ type: "ai.decided" }
>;

const OPEN_PREFERENCE = "riftlegends.draft.aiPanel.open";
// The contract uses fixed-point scores and probabilities per 10,000.
const SCALE = 10_000;

function storedOpen() {
	try {
		return localStorage.getItem(OPEN_PREFERENCE) === "true";
	} catch {
		return false;
	}
}

function DecisionDetails({
	decision,
	options,
}: {
	decision: Decision;
	options: SeriesOptions;
}) {
	const { t, i18n } = useTranslation();
	const number = new Intl.NumberFormat(i18n.language, {
		maximumFractionDigits: 4,
	});
	const percent = new Intl.NumberFormat(i18n.language, {
		style: "percent",
		maximumFractionDigits: 2,
	});
	const points = (value: number) =>
		t(
			value > 0
				? "draft.aiPanel.pointsFor"
				: value < 0
					? "draft.aiPanel.pointsAgainst"
					: "draft.aiPanel.pointsNone",
			{ points: number.format(Math.abs(value) / SCALE) },
		);
	return (
		<>
			<p className="mt-1 font-semibold tabular-nums">
				{t("draft.aiPanel.total", { points: points(decision.total) })}
			</p>
			<div className="mt-2 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-3">
				{decision.components.length > 0 ? (
					<table className="w-full">
						<caption className="mb-1 text-left font-bold">
							{t("draft.aiPanel.factors")}
						</caption>
						<tbody>
							{decision.components.map(({ key, points: value }) => (
								<tr key={key} className="border-line border-b">
									<th
										scope="row"
										className="py-1 pr-2 text-left font-normal text-muted [overflow-wrap:anywhere]"
									>
										{t(
											`draft.aiPanel.factor.${key}` as "draft.aiPanel.factor.meta",
											{
												defaultValue: key,
											},
										)}
									</th>
									<td className="py-1 text-right tabular-nums">
										{points(value)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<p className="text-muted">{t("draft.aiPanel.noFactors")}</p>
				)}
				{decision.alternatives.length > 0 ? (
					<table className="w-full">
						<caption className="mb-1 text-left font-bold">
							{t("draft.aiPanel.alternatives")}
						</caption>
						<thead>
							<tr className="text-muted">
								<th scope="col" className="sr-only">
									{t("draft.aiPanel.champion")}
								</th>
								<th scope="col" className="pb-1 text-right font-normal">
									{t("draft.aiPanel.chance")}
								</th>
							</tr>
						</thead>
						<tbody>
							{decision.alternatives.map(({ champion, chance }) => (
								<tr key={champion} className="border-line border-b">
									<th
										scope="row"
										className="max-w-0 truncate py-1 pr-2 text-left font-normal text-muted"
									>
										{championLabel(options, champion)}
									</th>
									<td className="whitespace-nowrap py-1 text-right tabular-nums">
										{percent.format(chance / SCALE)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<p className="text-muted">{t("draft.aiPanel.noAlternatives")}</p>
				)}
			</div>
			{decision.reply && (
				<p className="mt-2 truncate text-muted">
					{t("draft.aiPanel.reply", {
						champion: championLabel(options, decision.reply.champion),
					})}
				</p>
			)}
		</>
	);
}

/** Mounted for the whole draft, including while the explanation is collapsed. */
export const AiDecisionPanel = memo(function AiDecisionPanel({
	game,
	options,
	rival,
	side,
}: {
	game: number;
	options: SeriesOptions;
	rival: string | null;
	side: Side | null;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(storedOpen);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	useFacts((facts) => {
		if (!rival) return;
		for (const fact of facts) {
			if (
				fact.type !== "ai.decided" ||
				fact.team !== rival ||
				fact.game !== game
			)
				continue;
			const parsed = draftFacts.schema.safeParse(fact);
			if (!parsed.success || parsed.data.type !== "ai.decided") continue;
			const decision = parsed.data;
			setDecisions((previous) =>
				previous[0] && previous[0].position >= decision.position
					? previous
					: [decision, ...previous],
			);
		}
	});

	const [latest, ...earlier] = decisions;
	const label = ({ champion, action }: Decision) =>
		champion === null
			? t("draft.aiPanel.skippedBan")
			: t(`draft.aiPanel.${action}`, {
					champion: championLabel(options, champion),
				});

	return (
		<InspectionPanel
			id="ai-read"
			title={t("draft.aiPanel.title")}
			note={latest ? teamName(options, latest.team) : undefined}
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				try {
					localStorage.setItem(OPEN_PREFERENCE, String(next));
				} catch {
					// The panel still works if the preference cannot be saved.
				}
			}}
			accent={side === "blue" ? "border-side-blue" : "border-side-red"}
		>
			{latest ? (
				<div className="mt-3 text-[13px]">
					<section aria-labelledby="latest-ai-decision">
						<h3 id="latest-ai-decision" className="truncate font-bold text-sm">
							{label(latest)}
						</h3>
						<DecisionDetails decision={latest} options={options} />
					</section>
					{earlier.length > 0 && (
						<>
							<h3 id="ai-history-title" className="mt-4 mb-1 font-bold">
								{t("draft.aiPanel.history")}
							</h3>
							<ul aria-labelledby="ai-history-title">
								{earlier.map((decision) => (
									<li
										key={decision.position}
										className="border-line border-t py-1.5"
									>
										<details className="group/decision">
											<summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
												<ChevronRight
													aria-hidden="true"
													className="size-3.5 shrink-0 group-open/decision:rotate-90"
												/>
												<span className="truncate">{label(decision)}</span>
											</summary>
											<DecisionDetails decision={decision} options={options} />
										</details>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			) : (
				<p className="mt-2 text-[13px] text-muted">
					{t("draft.aiPanel.empty")}
				</p>
			)}
		</InspectionPanel>
	);
});
