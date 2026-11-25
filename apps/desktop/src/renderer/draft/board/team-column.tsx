import {
	type DraftView,
	ROLES,
	type Role,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { BAN_STRIKE } from "@rift-legends/ui-kit/components/champion-face";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { Ban } from "lucide-react";
import { type CSSProperties, memo, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { pacing } from "../broadcast/pacing";
import { ChampionPortrait } from "../champion-portrait";
import { championLabel, teamName } from "../session";
import { TeamCrest } from "../team-crest";
import { PickArt } from "./pick-art";

export interface PlayerRef {
	team: string;
	role: Role;
}

const SIDE = {
	blue: { letter: "B", text: "text-side-blue", border: "border-side-blue" },
	red: { letter: "R", text: "text-side-red", border: "border-side-red" },
} as const;

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

/**
 * A side of the draft: a fixed row per player, top to support, with the pick
 * placed in it, and its five ban slots. Clicking a row (or Enter and
 * Space) selects its player for the player card; hover and focus do not (#376).
 */
export const TeamColumn = memo(function TeamColumn(props: {
	side: Side;
	first: boolean;
	team: DraftView[Side];
	options: SeriesOptions;
	/** Index of the pick the user is choosing now, if any; it is also the row of the player who picks it. */
	current: number | null;
	/** The champion selected in the pool for that pick, shown faded until it is confirmed. */
	preview?: string | null;
	/** The role whose player the player card shows, if they are on this team. */
	selected?: Role | null;
	/** Whether this side bans now: its next ban slot is marked. */
	banning?: boolean;
	onPlayer: (player: PlayerRef) => void;
}) {
	const { t } = useTranslation();
	const { options, team } = props;
	const name = teamName(options, team.team);
	const players = options.teams.find(({ id }) => id === team.team)?.players;
	const id = useId();
	const style = SIDE[props.side];
	const reduced = useReducedMotion();
	const banPreview = (props.banning && props.preview) || null;
	const freshBan = useFreshBan(team.bans, banPreview);
	return (
		<section
			data-card-side={props.side}
			aria-labelledby={`${id}-side ${id}-team`}
			className={`flex min-h-0 flex-col border-t-[3px] bg-panel px-[15px] py-3 ${style.border}`}
		>
			<header
				className={`flex items-center justify-between gap-3.5 ${style.text}`}
			>
				<div className="min-w-0">
					<p className="font-semibold text-[12px] uppercase tracking-[0.055em]">
						<span id={`${id}-side`}>{t(`draft.side.${props.side}`)}</span>
						{props.first && (
							<span className="ml-2 text-text">{t("draft.side.first")}</span>
						)}
					</p>
					<Tooltip content={name}>
						<h2
							id={`${id}-team`}
							className="truncate font-bold font-display text-[29px] text-text leading-tight tracking-heading"
						>
							{name}
						</h2>
					</Tooltip>
				</div>
				<span className="shrink-0 [&_img]:h-12 [&_img]:w-16 [&_svg]:h-12 [&_svg]:w-16">
					<TeamCrest id={team.team} name={name} />
				</span>
			</header>
			<ol className="my-1 grid flex-1 auto-rows-fr gap-1">
				{ROLES.map((role, row) => {
					const current = row === props.current;
					const champion =
						team.picks[row] ?? (current ? props.preview : undefined);
					const slot = style.letter + (row + 1);
					// Selected in the pool but not confirmed yet (#435).
					const pending = current && !!champion && !team.picks[row];
					const label = champion
						? championLabel(options, champion)
						: current
							? t("draft.board.yourPick")
							: t("draft.board.pending");
					const handle = players?.find((p) => p.role === role)?.handle;
					return (
						<li key={role} className="flex">
							<Tooltip heading={label} content={handle}>
								<button
									type="button"
									data-card-champion={champion ?? undefined}
									aria-keyshortcuts={champion ? "I" : undefined}
									aria-controls="player-card"
									aria-pressed={props.selected === role}
									data-pending={pending || undefined}
									onClick={() => props.onPlayer({ team: team.team, role })}
									className={`press relative cursor-pointer isolate flex min-h-[clamp(48px,7.8vh,88px)] w-full items-center gap-2 overflow-hidden border border-line bg-surface/50 px-2 text-left outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action aria-pressed:bg-action/10 aria-pressed:ring-2 aria-pressed:ring-action aria-pressed:ring-inset ${current ? `bg-surface shadow-[inset_2px_0_currentColor] ${style.text}` : ""}`}
								>
									{champion && (
										<span
											data-preview={pending ? "pending" : "locked"}
											className={`pointer-events-none absolute inset-y-px right-px -z-10 w-[85%] overflow-hidden [container-type:size] [mask-image:linear-gradient(to_right,transparent,rgb(0_0_0/0.15)_20%,rgb(0_0_0/0.45)_40%,rgb(0_0_0/0.8)_60%,#000_78%)] ${pending ? (reduced ? "opacity-50" : "draft-pending") : "opacity-100 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:starting:opacity-50"}`}
											style={pending && !reduced ? PULSE : undefined}
										>
											<PickArt key={champion} id={champion} label={label} />
										</span>
									)}
									<span className={style.text}>
										<GameRoleIcon
											role={role}
											label={t(`market.role.${role}`)}
										/>
									</span>
									<span className="min-w-0 max-w-3/5">
										<small className="block text-[11px] text-muted">
											{slot}
										</small>
										<strong className="block truncate font-display text-[clamp(16px,1.4vw,23px)] leading-tight [text-shadow:0_1px_3px_rgb(0_0_0/0.85)]">
											{handle}
										</strong>
										{current && (
											<small className="block text-[11px]">
												{t(
													pending
														? "draft.board.choosing"
														: "draft.board.yourPick",
												)}
											</small>
										)}
									</span>
								</button>
							</Tooltip>
						</li>
					);
				})}
			</ol>
			<p
				id={`${id}-bans`}
				className={`font-semibold text-[12px] uppercase tracking-[0.055em] ${style.text}`}
			>
				{t("draft.board.bans")}
			</p>
			<ul
				aria-labelledby={`${id}-bans`}
				className="mt-[3px] flex h-[clamp(37px,5.4vh,62px)] gap-1"
			>
				{BAN_PHASES.map((phase, index) => {
					const active = props.banning === true && index === team.bans.length;
					return (
						<BanSlot
							// biome-ignore lint/suspicious/noArrayIndexKey: the five slots are fixed.
							key={index}
							phase={phase}
							opensPhase={index === 3}
							ban={team.bans[index]}
							active={active}
							options={options}
							sideClass={`${style.border} ${style.text}`}
							fresh={freshBan?.index === index ? freshBan.from : null}
							preview={active ? banPreview : null}
							reduced={reduced}
						/>
					);
				})}
			</ul>
		</section>
	);
});
