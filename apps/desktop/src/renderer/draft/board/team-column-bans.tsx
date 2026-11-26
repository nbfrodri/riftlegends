import type { SeriesOptions } from "@rift-legends/contracts";
import { BAN_STRIKE } from "@rift-legends/ui-kit/components/champion-face";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { Ban } from "lucide-react";
import { type CSSProperties, useRef } from "react";
import { useTranslation } from "react-i18next";
import { pacing } from "../broadcast/pacing";
import { ChampionPortrait } from "../champion-portrait";
import { championLabel } from "../session";

const PULSE = {
	animationDuration: `${pacing.pendingPulseMs}ms`,
} as const;

const STAMP = {
	animationDuration: `${pacing.banStampMs}ms`,
	"--ban-ms": `${pacing.banStampMs}ms`,
} as CSSProperties;

/** How a new ban arrives: entering its slot, or from the user's preview. */
type Fresh = "enter" | "preview";

/**
 * The ban this side has just made, while it is its latest one. Bans already
 * there on mount, skipped bans and reduced motion give `null`, so only a new
 * ban plays its stamp and nothing replays on a remount. A ban the user was
 * previewing is already in place, so it only greys out and is stamped.
 */
function useFreshBan(
	bans: readonly (string | null)[],
	preview: string | null,
): { index: number; from: Fresh } | null {
	const seen = useRef(bans.length);
	const previewed = useRef<string | null>(null);
	const fresh = useRef<{ index: number; from: Fresh } | null>(null);
	if (bans.length !== seen.current) {
		const ban = bans.at(-1);
		fresh.current =
			bans.length > seen.current && ban
				? {
						index: bans.length - 1,
						from: ban === previewed.current ? "preview" : "enter",
					}
				: null;
		seen.current = bans.length;
	}
	previewed.current = preview;
	return fresh.current;
}

/** Three bans in the first phase and two in the second, as on broadcasts. */
const BAN_PHASES = [1, 1, 1, 2, 2] as const;

/**
 * One of the five fixed ban slots (#436): empty with a dimmed ban icon, the
 * banned champion's greyed portrait, or a skipped ban. The slot of the active
 * ban turn is outlined in the side's colour and pulses.
 */
function BanSlot(props: {
	phase: 1 | 2;
	/** The first slot of the second phase keeps a gap from the first three. */
	opensPhase: boolean;
	/** `undefined` until its turn comes, `null` when the ban was skipped. */
	ban: string | null | undefined;
	active: boolean;
	options: SeriesOptions;
	/** The side's border and text colour, for the active slot. */
	sideClass: string;
	/** A ban just made: it enters (unless previewed), greys out and is stamped once. */
	fresh: Fresh | null;
	/** The champion the user has selected for the active ban, not confirmed yet. */
	preview: string | null;
	reduced: boolean;
}) {
	const { t } = useTranslation();
	const { ban, preview, reduced } = props;
	const fresh = reduced ? null : props.fresh;
	const state =
		ban === undefined
			? preview
				? "preview"
				: "empty"
			: ban === null
				? "skipped"
				: "banned";
	const label = ban ? championLabel(props.options, ban) : "";

	return (
		<li
			data-ban-slot={state}
			data-ban-phase={props.phase}
			aria-current={props.active ? "step" : undefined}
			className={`flex min-w-0 flex-1 ${props.opensPhase ? "ml-2.5" : ""}`}
		>
			{ban ? (
				<Tooltip content={label}>
					<button
						type="button"
						data-card-champion={ban}
						aria-keyshortcuts="I"
						aria-label={label}
						className={`relative flex size-full cursor-pointer overflow-hidden rounded-control focus-visible:outline-action ${fresh === "enter" ? "draft-ban-enter" : ""}`}
						style={fresh ? STAMP : undefined}
					>
						<ChampionPortrait id={ban} label={label} size="tile" unavailable />
						{fresh && (
							<span
								data-ban-stamp
								style={STAMP}
								className="pointer-events-none absolute inset-0 grid place-items-center"
							>
								<span className="draft-ban-colour absolute inset-0 flex">
									<ChampionPortrait id={ban} size="tile" />
								</span>
								<Ban
									aria-hidden="true"
									className="draft-ban-mark relative size-5 text-text drop-shadow"
								/>
							</span>
						)}
					</button>
				</Tooltip>
			) : state === "preview" && preview ? (
				// Only the portrait pulses, without a border (#435, #436); the
				// ban's line stays over it, steady (#494).
				<span className="relative flex size-full overflow-hidden rounded-control">
					<span
						data-ban-preview
						className={`flex size-full ${reduced ? "opacity-50" : "draft-pending"}`}
						style={reduced ? undefined : PULSE}
					>
						<ChampionPortrait
							id={preview}
							label={championLabel(props.options, preview)}
							size="tile"
						/>
					</span>
					<span
						data-ban-strike
						aria-hidden="true"
						className={`pointer-events-none absolute inset-0 ${BAN_STRIKE}`}
					/>
				</span>
			) : (
				<span
					className={`grid size-full place-items-center rounded-control border ${
						props.active
							? `draft-pending border-2 bg-surface ${props.sideClass}`
							: state === "skipped"
								? "border-line border-dashed text-muted"
								: "border-line/60 text-muted/40"
					}`}
					style={props.active ? PULSE : undefined}
				>
					<Ban aria-hidden="true" className="size-4" />
					<span className="sr-only">
						{t(
							state === "skipped" ? "draft.board.noBan" : "draft.board.pending",
						)}
					</span>
				</span>
			)}
		</li>
	);
}

export function TeamColumnBans({
	id,
	bans,
	options,
	banning,
	preview,
	sideText,
	sideBorder,
	reduced,
}: {
	id: string;
	bans: readonly (string | null)[];
	options: SeriesOptions;
	banning: boolean;
	preview: string | null;
	sideText: string;
	sideBorder: string;
	reduced: boolean;
}) {
	const { t } = useTranslation();
	const banPreview = (banning && preview) || null;
	const freshBan = useFreshBan(bans, banPreview);
	return (
		<>
			<p
				id={`${id}-bans`}
				className={`font-semibold text-[12px] uppercase tracking-[0.055em] ${sideText}`}
			>
				{t("draft.board.bans")}
			</p>
			<ul
				aria-labelledby={`${id}-bans`}
				className="mt-[3px] flex h-[clamp(37px,5.4vh,62px)] gap-1"
			>
				{BAN_PHASES.map((phase, index) => {
					const active = banning && index === bans.length;
					return (
						<BanSlot
							// biome-ignore lint/suspicious/noArrayIndexKey: the five slots are fixed.
							key={index}
							phase={phase}
							opensPhase={index === 3}
							ban={bans[index]}
							active={active}
							options={options}
							sideClass={`${sideBorder} ${sideText}`}
							fresh={freshBan?.index === index ? freshBan.from : null}
							preview={active ? banPreview : null}
							reduced={reduced}
						/>
					);
				})}
			</ul>
		</>
	);
}
