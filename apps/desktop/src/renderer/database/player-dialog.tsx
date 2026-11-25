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
import { PlayerAge } from "../player-age";
import type { DatabasePlayer } from "./database-filters";

export interface OpenPlayer {
	player: DatabasePlayer;
	/** Gets the focus back when the card closes. */
	trigger: HTMLElement | null;
}

/**
 * The player card (U5) as a modal: who the player is, then the attributes by
 * area and the champion pool. Escape or a click outside closes it. It takes
 * most of the window and its type scales with it (#544); it scrolls inside
 * only when the content does not fit.
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
			className="m-auto h-[min(84dvh,820px)] max-h-none w-[min(90vw,1360px)] max-w-none overflow-y-auto border-action border-t-2 bg-panel p-0 text-text backdrop:bg-black/65"
		>
			<div className="flex min-h-full flex-col justify-between gap-[clamp(14px,3vh,32px)] px-[clamp(18px,2.4vw,44px)] py-[clamp(16px,3vh,36px)]">
				<header className="flex items-center gap-[clamp(16px,2vw,32px)]">
					<PlayerPortrait
						id={player.id}
						handle={player.handle}
						size="h-[clamp(112px,21vh,220px)] w-[clamp(90px,16.8vh,176px)]"
					/>
					<div className="min-w-0 flex-1">
						<h2 className="flex items-baseline gap-[0.3em] font-bold font-display text-[clamp(30px,6vh,64px)] leading-none tracking-heading">
							{player.handle}
							<CountryFlag
								country={player.nationality}
								className="h-[0.42em] w-[0.63em]"
							/>
						</h2>
						<p className="mt-[clamp(10px,2vh,20px)] flex flex-wrap items-center gap-x-[clamp(16px,2vw,32px)] gap-y-1 text-[clamp(14px,2.3vh,20px)] text-muted">
							<span className="inline-flex items-center gap-2 text-text">
								<TeamCrest
									id={player.team}
									name={player.teamName}
									className="size-[1.4em]"
								/>
								<span>{player.teamName}</span>
							</span>
							{player.league && (
								<span className="inline-flex items-center gap-2">
									<span aria-hidden="true" className="inline-flex">
										<LeagueLogo
											id={player.league}
											name={player.league}
											className="size-[1.25em]"
										/>
									</span>
									{player.league}
								</span>
							)}
							<span className="inline-flex items-center gap-2">
								<GameRoleIcon role={player.role} size={20} />
								{t(`market.role.${player.role}`)}
							</span>
							<PlayerAge birthDate={player.birthDate} withUnit />
							<span>
								{t(
									player.sub
										? "database.status.sub"
										: "database.status.starter",
								)}
							</span>
						</p>
					</div>
					<p className="self-center text-right">
						<span className="block text-[clamp(13px,2vh,17px)] text-muted">
							{t("market.column.rating")}
						</span>
						<span
							className={`block font-bold font-display text-[clamp(44px,9vh,96px)] leading-none tabular-nums ${levelColor[level]}`}
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
						className="press grid size-9 shrink-0 cursor-pointer place-items-center self-start rounded-control text-muted hover:bg-surface hover:text-action"
					>
						<X size={20} aria-hidden />
					</button>
				</header>
				<div>
					<PlayerAttributes
						attributes={player.attributes}
						role={player.role}
						estimated={player.estimated}
						size="dialog"
					/>
				</div>
				<div>
					<PlayerPool pool={player.pool} names={championNames} size="dialog" />
				</div>
			</div>
		</dialog>
	);
}
