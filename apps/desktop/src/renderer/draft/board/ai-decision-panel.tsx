import {
	draftFacts,
	ROLES,
	type Role,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { Ban, Minus, Plus } from "lucide-react";
import { memo, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { useFacts } from "../../core";
import { ChampionPortrait } from "../champion-portrait";
import { championLabel, teamName } from "../session";
import { InspectionPanel } from "./player-card";

type Decision = Extract<
	ReturnType<typeof draftFacts.schema.parse>,
	{ type: "ai.decided" }
>;
type Component = Decision["components"][number];
type Alternative = Decision["alternatives"][number];

export const AI_PANEL_ID = "ai-read";
const OPEN_PREFERENCE = "riftlegends.draft.aiPanel.open";
// Scores are fixed point per 10,000: half a point apart is a close call.
const CLOSE_GAP = 5_000;
const LABEL =
	"font-semibold text-[11px] text-muted uppercase tracking-[0.055em]";

function storedOpen() {
	try {
		return localStorage.getItem(OPEN_PREFERENCE) === "true";
	} catch {
		return false;
	}
}

export function useAiPanelOpen() {
	const [open, setOpen] = useState(storedOpen);
	useEffect(() => {
		try {
			localStorage.setItem(OPEN_PREFERENCE, String(open));
		} catch {
			// The panel still works if the preference cannot be saved.
		}
	}, [open]);
	return [open, setOpen] as const;
}

/** Weight of a factor relative to the strongest one of its decision. */
const weightOf = (points: number, strongest: number) => {
	const share = Math.abs(points) / strongest;
	return share >= 0.6 ? "high" : share >= 0.3 ? "medium" : "low";
};

/** Why an option the AI weighed ranked behind its choice, in words. */
const behindOf = (alternative: Alternative, chosen: Decision) => {
	if (alternative.total >= chosen.total) return "higher";
	if (alternative.chance === 0) return "outside";
	return chosen.total - alternative.total <= CLOSE_GAP ? "close" : "some";
};

/** Factors as words with a short bar each; the weight is read out as a word. */
function Factors({
	id,
	title,
	factors,
	strongest,
	tone,
}: {
	id: string;
	title: string;
	factors: readonly Component[];
	strongest: number;
	tone: "bg-good" | "bg-bad";
}) {
	const { t } = useTranslation();
	if (factors.length === 0) return null;
	return (
		<>
			<h4 id={id} className={`mt-2 mb-1 ${LABEL}`}>
				{title}
			</h4>
			<ul aria-labelledby={id} className="grid gap-1">
				{factors.map(({ key, points }) => (
					<li
						key={key}
						className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3"
					>
						<span className="truncate">
							{t(`draft.aiPanel.factor.${key}` as "draft.aiPanel.factor.meta", {
								defaultValue: key,
							})}
						</span>
						<span
							aria-hidden="true"
							className="h-1.5 overflow-hidden rounded-full bg-surface"
						>
							<span
								className={`block h-full rounded-full ${tone}`}
								style={{
									width: `${Math.max(10, Math.round((Math.abs(points) * 100) / strongest))}%`,
								}}
							/>
						</span>
						<span className="sr-only">
							{t(`draft.aiPanel.weight.${weightOf(points, strongest)}`)}
						</span>
					</li>
				))}
			</ul>
		</>
	);
}

function DecisionEntry({
	decision,
	open,
	options,
	role,
}: {
	decision: Decision;
	open: boolean;
	options: SeriesOptions;
	role: Role | null;
}) {
	const { t } = useTranslation();
	const id = useId();
	const { champion, reply } = decision;
	const factors = [...decision.components].sort(
		(a, b) => Math.abs(b.points) - Math.abs(a.points),
	);
	const strongest = Math.max(1, ...factors.map((f) => Math.abs(f.points)));
	const handle =
		role &&
		options.teams
			.find((team) => team.id === decision.team)
			?.players.find((player) => player.role === role)?.handle;
	return (
		<details open={open} className="group/decision">
			<summary className="flex cursor-pointer list-none items-center gap-2.5 py-2 outline-offset-2 hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-action [&::-webkit-details-marker]:hidden">
				{champion ? (
					<ChampionPortrait
						id={champion}
						size="ban"
						label={championLabel(options, champion)}
					/>
				) : (
					<span className="grid size-8 shrink-0 place-items-center bg-surface text-muted">
						<Ban aria-hidden="true" className="size-4" />
					</span>
				)}
				<span className="min-w-0 flex-1">
					<span className={`block ${LABEL}`}>
						{t(`draft.aiPanel.action.${decision.action}`)}
					</span>
					<strong className="block truncate">
						{champion
							? championLabel(options, champion)
							: t("draft.aiPanel.skippedBan")}
					</strong>
				</span>
				{role && (
					<span className="flex min-w-0 shrink items-center gap-1.5 text-muted">
						<GameRoleIcon role={role} label={t(`market.role.${role}`)} />
						<span className="truncate">{handle}</span>
					</span>
				)}
				<Plus
					aria-hidden="true"
					className="size-3.5 shrink-0 text-muted group-open/decision:hidden"
				/>
				<Minus
					aria-hidden="true"
					className="hidden size-3.5 shrink-0 text-muted group-open/decision:block"
				/>
			</summary>
			<div className="pb-3 pl-[42px]">
				{factors.length === 0 ? (
					<p className="mt-1 text-muted">{t("draft.aiPanel.noFactors")}</p>
				) : (
					<>
						<Factors
							id={`${id}-reasons`}
							title={t("draft.aiPanel.reasons")}
							factors={factors.filter((f) => f.points > 0)}
							strongest={strongest}
							tone="bg-good"
						/>
						<Factors
							id={`${id}-against`}
							title={t("draft.aiPanel.against")}
							factors={factors.filter((f) => f.points < 0)}
							strongest={strongest}
							tone="bg-bad"
						/>
					</>
				)}
				{reply && (
					<>
						<h4 className={`mt-3 mb-1 ${LABEL}`}>{t("draft.aiPanel.reply")}</h4>
						<p className="flex items-center gap-2">
							<ChampionPortrait
								id={reply.champion}
								size="compact"
								label={championLabel(options, reply.champion)}
							/>
							<span className="truncate">
								{championLabel(options, reply.champion)}
							</span>
						</p>
					</>
				)}
				{decision.alternatives.length > 0 && (
					<>
						<h4 id={`${id}-alternatives`} className={`mt-3 mb-1 ${LABEL}`}>
							{t("draft.aiPanel.alternatives")}
						</h4>
						<ul aria-labelledby={`${id}-alternatives`} className="grid gap-1.5">
							{decision.alternatives.map((alternative) => {
								const name = championLabel(options, alternative.champion);
								return (
									<li
										key={alternative.champion}
										className="flex items-center gap-2"
									>
										<ChampionPortrait
											id={alternative.champion}
											size="compact"
											label={name}
										/>
										<span className="min-w-0">
											<span className="block truncate">{name}</span>
											<span className="block text-[12px] text-muted">
												{t(
													`draft.aiPanel.behind.${behindOf(alternative, decision)}`,
												)}
											</span>
										</span>
									</li>
								);
							})}
						</ul>
					</>
				)}
			</div>
		</details>
	);
}

/** Mounted for the whole draft, including while the explanation is collapsed. */
export const AiDecisionPanel = memo(function AiDecisionPanel({
	game,
	options,
	rival,
	picks,
	side,
	open,
	onOpenChange,
}: {
	game: number;
	options: SeriesOptions;
	rival: string | null;
	/** The rival's picks in player-row order: a pick's row is its player's role. */
	picks: readonly string[];
	side: Side | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
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

	// Until the board's view catches up, the order of the AI's picks gives the row.
	const pickOrder = decisions.filter((d) => d.action === "pick").reverse();
	const roleOf = (decision: Decision): Role | null => {
		if (decision.action !== "pick" || !decision.champion) return null;
		const row = picks.indexOf(decision.champion);
		return ROLES[row >= 0 ? row : pickOrder.indexOf(decision)] ?? null;
	};

	return (
		<InspectionPanel
			id={AI_PANEL_ID}
			title={t("draft.aiPanel.title")}
			note={decisions[0] ? teamName(options, decisions[0].team) : undefined}
			open={open}
			onOpenChange={onOpenChange}
			accent={side === "blue" ? "border-side-blue" : "border-side-red"}
		>
			{decisions.length > 0 ? (
				<ol
					aria-label={t("draft.aiPanel.decisions")}
					className="mt-1 text-[13px]"
				>
					{decisions.map((decision, index) => (
						<li
							key={decision.position}
							className="border-line border-t first:border-t-0"
						>
							<DecisionEntry
								decision={decision}
								open={index === 0}
								options={options}
								role={roleOf(decision)}
							/>
						</li>
					))}
				</ol>
			) : (
				<p className="mt-2 text-[13px] text-muted">
					{t("draft.aiPanel.empty")}
				</p>
			)}
		</InspectionPanel>
	);
});
