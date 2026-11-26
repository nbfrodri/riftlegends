import type { Role, SeriesOptions } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { pacing } from "../broadcast/pacing";
import { championLabel } from "../session";
import { PickArt } from "./pick-art";

const PULSE = {
	animationDuration: `${pacing.pendingPulseMs}ms`,
} as const;

export function DraftPickRow({
	role,
	slot,
	champion,
	handle,
	current,
	pending,
	selected,
	sideText,
	reduced,
	options,
	onSelect,
}: {
	role: Role;
	slot: string;
	champion: string | null | undefined;
	handle: string | undefined;
	current: boolean;
	pending: boolean;
	selected: boolean;
	sideText: string;
	reduced: boolean;
	options: SeriesOptions;
	onSelect: () => void;
}) {
	const { t } = useTranslation();
	const label = champion
		? championLabel(options, champion)
		: current
			? t("draft.board.yourPick")
			: t("draft.board.pending");
	return (
		<li className="flex">
			<Tooltip heading={label} content={handle}>
				<button
					type="button"
					data-card-champion={champion ?? undefined}
					aria-keyshortcuts={champion ? "I" : undefined}
					aria-controls="player-card"
					aria-pressed={selected}
					data-pending={pending || undefined}
					onClick={onSelect}
					className={`press relative cursor-pointer isolate flex min-h-[clamp(48px,7.8vh,88px)] w-full items-center gap-2 overflow-hidden border border-line bg-surface/50 px-2 text-left outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action aria-pressed:bg-action/10 aria-pressed:ring-2 aria-pressed:ring-action aria-pressed:ring-inset ${current ? `bg-surface shadow-[inset_2px_0_currentColor] ${sideText}` : ""}`}
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
					<span className={sideText}>
						<GameRoleIcon role={role} label={t(`market.role.${role}`)} />
					</span>
					<span className="min-w-0 max-w-3/5">
						<small className="block text-[11px] text-muted">{slot}</small>
						<strong className="block truncate font-display text-[clamp(16px,1.4vw,23px)] leading-tight [text-shadow:0_1px_3px_rgb(0_0_0/0.85)]">
							{handle}
						</strong>
						{current && (
							<small className="block text-[11px]">
								{t(pending ? "draft.board.choosing" : "draft.board.yourPick")}
							</small>
						)}
					</span>
				</button>
			</Tooltip>
		</li>
	);
}
