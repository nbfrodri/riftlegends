import type { PlayerAttribute, SeriesOptions } from "@rift-legends/contracts";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@rift-legends/ui-kit/components/tooltip";
import { ChevronRight, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type Stat, StatIcon } from "../../assets/stat-icon";

type Attributes =
	SeriesOptions["teams"][number]["players"][number]["attributes"];

/** The 20 attributes by area, in the order of the approved mockup (plan 08). */
const AREAS = [
	["lane", ["lanes", "farming", "waves"]],
	["map", ["macro", "roaming", "vision", "anticipation", "objectiveControl"]],
	["fight", ["teamfight", "mechanics", "positioning", "aggression"]],
	["mental", ["composure", "resilience", "experience", "consistency", "focus"]],
	["team", ["shotcalling", "communication", "versatility"]],
] as const satisfies readonly (readonly [string, readonly PlayerAttribute[]])[];

/** Attributes that match a scoreboard stat show its icon. */
const attributeIcons = {
	farming: "cs",
	vision: "vision",
} as const satisfies Partial<Record<PlayerAttribute, Stat>>;

/** A collapsible panel under the board, as in the mockup. */
export function InspectionPanel(props: {
	id: string;
	title: string;
	note?: string | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accent: string;
	children: ReactNode;
}) {
	return (
		<details
			id={props.id}
			aria-labelledby={`${props.id}-title`}
			open={props.open}
			onToggle={(event) => props.onOpenChange(event.currentTarget.open)}
			className={`group min-w-0 border-t-2 bg-panel px-[15px] py-3 ${props.accent}`}
		>
			<summary className="flex cursor-default list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
				<ChevronRight
					aria-hidden="true"
					className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
				/>
				<span
					id={`${props.id}-title`}
					className="font-bold font-display text-[17px] tracking-heading"
				>
					{props.title}
				</span>
				{props.note && (
					<span className="ml-auto text-[13px] text-muted">{props.note}</span>
				)}
			</summary>
			{props.children}
		</details>
	);
}

/** Marks an attribute estimated from the role rather than measured (plan 11). */
function EstimatedMark() {
	const { t } = useTranslation();
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<span
						role="img"
						aria-label={t("draft.board.estimated")}
						className="inline-flex text-muted"
					/>
				}
			>
				<CircleDashed aria-hidden="true" className="size-3" />
			</TooltipTrigger>
			<TooltipContent side="top">
				{t("draft.board.estimatedHint")}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * U5: a player's attributes by area; those estimated rather than measured
 * carry a mark. The rival's show the same until scouting (plan 19).
 */
export function PlayerAttributes({
	attributes,
	estimated = [],
}: {
	attributes: Attributes;
	estimated?: readonly PlayerAttribute[] | undefined;
}) {
	const { t } = useTranslation();
	const guessed = new Set(estimated);
	return (
		<>
			<p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
				{t("draft.board.attributeScale")}
				{guessed.size > 0 && (
					<span
						aria-hidden="true"
						className="ml-3 inline-flex items-center gap-1"
					>
						<CircleDashed className="size-3" />
						{t("draft.board.estimated")}
					</span>
				)}
			</p>
			<div className="mt-[9px] grid grid-cols-[1fr_1.2fr_1.06fr_1.16fr_1.22fr] gap-3">
				{AREAS.map(([area, keys]) => (
					<section key={area}>
						<h3 className="mb-1 font-bold text-[13px] text-action">
							{t(`draft.board.area.${area}`)}
						</h3>
						<dl className="text-[12px] leading-[1.47]">
							{keys.map((key) => (
								<div key={key} className="flex justify-between gap-2">
									<dt className="flex items-center gap-1 text-muted">
										{key in attributeIcons && (
											<StatIcon
												stat={
													attributeIcons[key as keyof typeof attributeIcons]
												}
												size={12}
											/>
										)}
										{t(`draft.board.attr.${key}`)}
									</dt>
									<dd className="flex items-center gap-1 font-semibold tabular-nums">
										{guessed.has(key) && <EstimatedMark />}
										{attributes[key]}
									</dd>
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</>
	);
}
