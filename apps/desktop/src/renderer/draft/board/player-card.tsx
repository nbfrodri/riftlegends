import {
	LOW_RELEVANCE,
	type PlayerAttribute,
	type Role,
	type SeriesOptions,
} from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePlayerPhotoSrc } from "../../assets";
import { levelColor, levelOf } from "../../level-scale";
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
}: {
	attributes: Attributes;
	role: Role;
	estimated?: readonly PlayerAttribute[] | undefined;
}) {
	const { t } = useTranslation();
	const guessed = new Set(estimated);
	const minor = new Set<PlayerAttribute>(LOW_RELEVANCE[role]);
	return (
		<>
			<p className="mt-1 text-[13px] text-muted">
				{t("draft.board.attributeScale")}
			</p>
			<div className="mt-[9px] grid grid-cols-[1fr_1.2fr_1.06fr_1.16fr_1.22fr] gap-3">
				{AREAS.map(([area, keys]) => (
					<section key={area}>
						<h3 className="mb-1 font-bold text-[13px] text-action">
							{t(`draft.board.area.${area}`)}
						</h3>
						<dl className="text-[12px] leading-[1.47]">
							{keys.map((key) => (
								<div
									key={key}
									className={`flex justify-between gap-2 ${minor.has(key) ? "opacity-50" : ""}`}
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
										className={`font-semibold tabular-nums ${guessed.has(key) ? "font-normal text-muted italic" : levelColor[levelOf(attributes[key])]}`}
									>
										{guessed.has(key) ? (
											<Tooltip
												heading={t("draft.board.estimated")}
												content={t("draft.board.estimatedWhy")}
											>
												<span>{attributes[key]}</span>
											</Tooltip>
										) : (
											attributes[key]
										)}
										<span className="sr-only">
											{" "}
											{t(`draft.board.level.${levelOf(attributes[key])}`)}
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

type Pool = SeriesOptions["teams"][number]["players"][number]["pool"];

/** The player's mains, secondary and weak champions with their mastery. */
export function PlayerPool({
	pool,
	names,
}: {
	pool: Pool;
	names: ReadonlyMap<string, string>;
}) {
	const { t } = useTranslation();
	if (pool.length === 0) return null;
	return (
		<section aria-label={t("draft.board.pool.title")} className="mt-3">
			<h3 className="mb-1 font-bold text-[13px] text-action">
				{t("draft.board.pool.title")}
			</h3>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{(["main", "secondary", "weak"] as const).map((kind) => {
					const rows = pool.filter((entry) => entry.kind === kind);
					return (
						rows.length > 0 && (
							<div key={kind} className="flex items-center gap-1.5">
								<span className="text-[12px] text-muted">
									{t(`draft.board.pool.${kind}`)}
								</span>
								<ul className="flex gap-1.5">
									{rows.map(({ champion, mastery }) => {
										const name = names.get(champion) ?? champion;
										return (
											<li
												key={champion}
												className="flex items-center gap-1"
												aria-label={t("draft.board.pool.mastery", {
													champion: name,
													value: mastery,
												})}
											>
												<ChampionPortrait id={champion} size="compact" />
												<span
													aria-hidden="true"
													className="font-semibold text-[12px] tabular-nums"
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
