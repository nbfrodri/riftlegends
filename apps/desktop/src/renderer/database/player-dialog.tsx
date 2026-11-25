import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { LeagueLogo } from "../assets/league-logo";
import {
	PlayerAttributes,
	PlayerPool,
	PlayerPortrait,
} from "../draft/board/player-card";
import { CountryFlag } from "../draft/country-flag";
import { TeamCrest } from "../draft/team-crest";
import { levelColor, levelOf } from "../level-scale";
import type { DatabasePlayer } from "./database-filters";

export interface OpenPlayer {
	player: DatabasePlayer;
	/** Gets the focus back when the card closes. */
	trigger: HTMLElement | null;
}

/**
 * The player card (U5) as a modal: who the player is, then the attributes by
 * area and the champion pool. Escape or a click outside closes it.
 */
export function PlayerDialog({
	open,
	championNames,
	onClose,
}: {
	open: OpenPlayer;
	championNames: ReadonlyMap<string, string>;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const dialog = useRef<HTMLDialogElement>(null);
	// Only a press that starts and ends on the backdrop closes (not a drag out).
	const pressedBackdrop = useRef(false);
	const close = useRef<HTMLButtonElement>(null);
	const { player, trigger } = open;
	useEffect(() => {
		const current = dialog.current;
		current?.showModal();
		// Escape reaches the dialog from inside it.
		close.current?.focus({ preventScroll: true });
		return () => {
			current?.close();
			trigger?.focus({ preventScroll: true });
		};
	}, [trigger]);
	const level = levelOf(player.level);
	return (
		<dialog
			ref={dialog}
			aria-label={t("database.card.label", { handle: player.handle })}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onPointerDown={(event) => {
				pressedBackdrop.current = event.target === event.currentTarget;
			}}
			onClick={(event) => {
				if (pressedBackdrop.current && event.target === event.currentTarget)
					onClose();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="m-auto max-h-[min(86dvh,640px)] w-[min(88vw,880px)] overflow-y-auto border-action border-t-2 bg-panel p-0 text-text backdrop:bg-black/65"
		>
			<div className="flex flex-col gap-3 px-[18px] py-4">
				<header className="flex items-center gap-4">
					<PlayerPortrait id={player.id} handle={player.handle} />
					<div className="min-w-0 flex-1">
						<h2 className="flex items-baseline gap-2 font-bold font-display text-[clamp(22px,2vw,30px)] leading-none tracking-heading">
							{player.handle}
							<CountryFlag country={player.nationality} />
						</h2>
						<p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
							<span className="inline-flex items-center gap-1.5 text-text">
								<TeamCrest
									id={player.team}
									name={player.teamName}
									className="size-5"
								/>
								<span>{player.teamName}</span>
							</span>
							{player.league && (
								<span className="inline-flex items-center gap-1.5">
									<span aria-hidden="true">
										<LeagueLogo id={player.league} name={player.league} />
									</span>
									{player.league}
								</span>
							)}
							<span className="inline-flex items-center gap-1.5">
								<GameRoleIcon role={player.role} size={16} />
								{t(`market.role.${player.role}`)}
							</span>
							<span>
								{t(
									player.sub
										? "database.status.sub"
										: "database.status.starter",
								)}
							</span>
						</p>
					</div>
					<p className="text-right">
						<span className="block text-[12px] text-muted">
							{t("market.column.rating")}
						</span>
						<span
							className={`font-bold font-display text-[28px] tabular-nums ${levelColor[level]}`}
						>
							{player.level}
						</span>
						<span className="sr-only"> {t(`draft.board.level.${level}`)}</span>
					</p>
					<button
						ref={close}
						type="button"
						aria-label={t("database.card.close")}
						onClick={onClose}
						className="press grid size-7 shrink-0 cursor-pointer place-items-center self-start rounded-control text-muted hover:bg-surface hover:text-action"
					>
						<X size={16} aria-hidden />
					</button>
				</header>
				<div>
					<PlayerAttributes
						attributes={player.attributes}
						role={player.role}
						estimated={player.estimated}
					/>
					<PlayerPool pool={player.pool} names={championNames} />
				</div>
			</div>
		</dialog>
	);
}
