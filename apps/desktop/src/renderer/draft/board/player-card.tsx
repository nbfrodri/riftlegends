import {
	LOW_RELEVANCE,
	type PlayerAttribute,
	type Role,
	type SeriesOptions,
} from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePlayerPhotoSrc } from "../../assets";
import { levelColor, levelFill, levelOf } from "../../level-scale";
import { ChampionPortrait } from "../champion-portrait";
import { useDraftContent } from "../session";

type Attributes =
	SeriesOptions["teams"][number]["players"][number]["attributes"];

export function PlayerPortrait({
	id,
	handle,
	size = "h-20 w-16 short:h-16 short:w-12",
}: {
	id: string;
	handle: string;
	/** Tailwind size classes of the frame; the card's by default. */
	size?: string;
}) {
	const { t } = useTranslation();
	const photo = usePlayerPhotoSrc(id);
	const content = useDraftContent();
	const [failed, setFailed] = useState<string>();
	const label = t("draft.board.playerPortrait", { handle });
	const frame = `${size} shrink-0 border border-line bg-surface`;
	return content === "real" && photo && photo !== failed ? (
		<img
			src={photo}
			alt={label}
			className={`${frame} object-cover object-top`}
			onError={() => setFailed(photo)}
		/>
	) : (
		<svg
			role="img"
			aria-label={label}
			viewBox="0 0 64 80"
			className={`${frame} text-muted`}
		>
			<circle cx="32" cy="28" r="11" fill="currentColor" />
			<path d="M12 64v-5c0-10 8-17 20-17s20 7 20 17v5z" fill="currentColor" />
		</svg>
	);
}

/** The 20 attributes by area, in the order of the approved mockup (plan 08). */
const AREAS = [
	["lane", ["lanes", "farming", "waves"]],
	["map", ["macro", "roaming", "vision", "anticipation", "objectiveControl"]],
	["fight", ["teamfight", "mechanics", "positioning", "aggression"]],
	["mental", ["composure", "resilience", "experience", "consistency", "focus"]],
	["team", ["shotcalling", "communication", "versatility"]],
] as const satisfies readonly (readonly [string, readonly PlayerAttribute[]])[];

/**
 * Type and spacing of the card's sections: `panel` for the draft's compact
 * panel, `dialog` for the large Database card, which scales with the window
 * (#544). Each area is a card and each attribute has a short bar (#558).
 */
type CardSize = "panel" | "dialog";
const CARD = {
	panel: {
		note: "mt-1 text-[13px]",
		grid: "mt-2 gap-2",
		card: "px-2.5 py-2",
		heading: "mb-1 text-[12px]",
		rows: "text-[12px] leading-[1.35]",
		row: "pb-[9px]",
		bar: "bottom-[4px] h-[3px]",
		pool: "mt-3",
		title: "mb-2 text-[12px]",
		groups: "gap-5",
		label: "mb-1 text-[12px]",
		list: "gap-2",
		item: "w-8",
		portrait: "ban",
		mbar: "mt-1 h-[3px]",
		mastery: "text-[11px]",
	},
	dialog: {
		note: "text-[clamp(13px,1.9vh,16px)]",
		grid: "mt-[clamp(6px,1.1vh,14px)] gap-[clamp(8px,1vw,16px)]",
		card: "px-[clamp(10px,1vw,18px)] py-[clamp(6px,1.1vh,14px)]",
		heading: "mb-[clamp(2px,0.5vh,8px)] text-[clamp(14px,2.2vh,19px)]",
		rows: "text-[clamp(13px,2vh,17px)] leading-[1.2]",
		row: "pb-[clamp(10px,1.7vh,15px)]",
		bar: "bottom-[clamp(4px,0.75vh,7px)] h-[clamp(3px,0.5vh,5px)]",
		pool: "",
		title: "mb-[clamp(4px,1vh,10px)] text-[clamp(14px,2.2vh,19px)]",
		groups: "gap-[clamp(20px,3vw,48px)]",
		label: "mb-[clamp(4px,0.8vh,10px)] text-[clamp(14px,2.2vh,18px)]",
		list: "gap-[clamp(8px,1vw,14px)]",
		item: "w-[clamp(40px,7vh,76px)]",
		portrait: "card",
		mbar: "mt-1 h-[clamp(3px,0.5vh,5px)]",
		mastery: "text-[clamp(13px,2vh,17px)]",
	},
} as const satisfies Record<CardSize, Record<string, string>>;

/** A short bar under a value, as wide as the value out of 100. */
function LevelBar(props: {
	slot: "level-bar" | "mastery-bar";
	value: number;
	fill: string;
	className: string;
}) {
	return (
		<span
			aria-hidden="true"
			data-slot={props.slot}
			className={`block bg-line/60 ${props.className}`}
		>
			<span
				className={`block h-full ${props.fill}`}
				style={{ width: `${props.value}%` }}
			/>
		</span>
	);
}

/**
 * A collapsible bar above the board. Open, its content drops over the board
 * and scrolls inside, so neither the board nor the page moves (#430).
 */
export function InspectionPanel(props: {
	id: string;
	title: string;
	note?: ReactNode;
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
			className={`group relative min-w-0 border-t-2 bg-panel px-[15px] py-3 ${props.accent}`}
		>
			<summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
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
					<span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
						{props.note}
					</span>
				)}
			</summary>
			<div
				data-slot="panel-body"
				className={`absolute inset-x-0 top-full z-30 max-h-[min(62vh,440px)] scroll-edge overscroll-contain border-t-2 bg-panel pr-[7px] pb-3 pl-[15px] shadow-[0_12px_32px_rgb(0_0_0/0.45)] ${props.accent}`}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the panel's body scrolls by keyboard.
				tabIndex={0}
			>
				{props.children}
			</div>
		</details>
	);
}

/**
 * U5: a player's attributes by area. Estimated values (not measurable with
 * stats) are italic and muted, explained in their tooltip (#398); attributes that
 * matter little for the player's role are dimmed and explained.
 */
export function PlayerAttributes({
	attributes,
	role,
	estimated = [],
	size = "panel",
}: {
	attributes: Attributes;
	role: Role;
	estimated?: readonly PlayerAttribute[] | undefined;
	size?: CardSize;
}) {
	const { t } = useTranslation();
	const style = CARD[size];
	const guessed = new Set(estimated);
	const minor = new Set<PlayerAttribute>(LOW_RELEVANCE[role]);
	return (
		<>
			<p className={`${style.note} text-muted`}>
				{t("draft.board.attributeScale")}
			</p>
			<div
				className={`${style.grid} grid grid-cols-[1fr_1.2fr_1.06fr_1.16fr_1.22fr]`}
			>
				{AREAS.map(([area, keys]) => (
					<section
						key={area}
						className={`border border-line bg-surface/40 ${style.card}`}
					>
						<h3
							className={`${style.heading} font-bold text-action uppercase tracking-wide`}
						>
							{t(`draft.board.area.${area}`)}
						</h3>
						<dl className={style.rows}>
							{keys.map((key) => {
								const value = attributes[key];
								const level = levelOf(value);
								return (
									<div
										key={key}
										className={`relative flex justify-between gap-2 ${style.row} ${minor.has(key) ? "opacity-50" : ""}`}
									>
										<dt className="text-muted">
											{minor.has(key) ? (
												<Tooltip content={t("draft.board.lowRelevance")}>
													<span>{t(`draft.board.attr.${key}`)}</span>
												</Tooltip>
											) : (
												t(`draft.board.attr.${key}`)
											)}
										</dt>
										<dd
											className={`font-semibold tabular-nums ${guessed.has(key) ? "font-normal text-muted italic" : levelColor[level]}`}
										>
											{guessed.has(key) ? (
												<Tooltip
													heading={t("draft.board.estimated")}
													content={t("draft.board.estimatedWhy")}
												>
													<span>{value}</span>
												</Tooltip>
											) : (
												value
											)}
											<span className="sr-only">
												{" "}
												{t(`draft.board.level.${level}`)}
											</span>
											{guessed.has(key) && (
												<span className="sr-only">
													{" "}
													{t("draft.board.estimated")}
												</span>
											)}
											{minor.has(key) && (
												<span className="sr-only">
													{" "}
													{t("draft.board.lowRelevance")}
												</span>
											)}
											<LevelBar
												slot="level-bar"
												value={value}
												fill={
													guessed.has(key) ? "bg-muted/40" : levelFill[level]
												}
												className={`absolute inset-x-0 ${style.bar}`}
											/>
										</dd>
									</div>
								);
							})}
						</dl>
					</section>
				))}
			</div>
		</>
	);
}

type Pool = SeriesOptions["teams"][number]["players"][number]["pool"];

/** The player's mains, secondary and weak champions with their mastery. */
export function PlayerPool({
	pool,
	names,
	size = "panel",
}: {
	pool: Pool;
	names: ReadonlyMap<string, string>;
	size?: CardSize;
}) {
	const { t } = useTranslation();
	const id = useId();
	const style = CARD[size];
	if (pool.length === 0) return null;
	return (
		<section aria-label={t("draft.board.pool.title")} className={style.pool}>
			<h3
				className={`${style.title} font-bold text-action uppercase tracking-wide`}
			>
				{t("draft.board.pool.title")}
			</h3>
			<div className={`flex flex-wrap ${style.groups}`}>
				{(["main", "secondary", "weak"] as const).map((kind) => {
					const rows = pool.filter((entry) => entry.kind === kind);
					return (
						rows.length > 0 && (
							<div key={kind}>
								<p id={`${id}-${kind}`} className={`${style.label} text-muted`}>
									{t(`draft.board.pool.${kind}`)}
								</p>
								<ul
									aria-labelledby={`${id}-${kind}`}
									className={`flex ${style.list}`}
								>
									{rows.map(({ champion, mastery }) => {
										const name = names.get(champion) ?? champion;
										const level = levelOf(mastery);
										return (
											<li
												key={champion}
												className={`flex flex-col ${style.item} ${kind === "weak" ? "opacity-55" : ""}`}
												aria-label={t("draft.board.pool.mastery", {
													champion: name,
													value: mastery,
												})}
											>
												<Tooltip content={name}>
													<span className="block">
														<ChampionPortrait
															id={champion}
															size={style.portrait}
														/>
													</span>
												</Tooltip>
												<LevelBar
													slot="mastery-bar"
													value={mastery}
													fill={levelFill[level]}
													className={style.mbar}
												/>
												<span
													aria-hidden="true"
													data-slot="mastery-value"
													className={`mt-0.5 text-center font-semibold tabular-nums ${style.mastery} ${levelColor[level]}`}
												>
													{mastery}
												</span>
											</li>
										);
									})}
								</ul>
							</div>
						)
					);
				})}
			</div>
		</section>
	);
}
