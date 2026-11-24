import {
	type DraftView,
	ROLES,
	type Role,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
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

/**
 * A side of the draft: a fixed row per player, top to support, with the pick
 * placed in it, and its bans as greyed portraits. Clicking a row (or Enter and
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
	onPlayer: (player: PlayerRef) => void;
}) {
	const { t } = useTranslation();
	const { options, team } = props;
	const name = teamName(options, team.team);
	const players = options.teams.find(({ id }) => id === team.team)?.players;
	const id = useId();
	const style = SIDE[props.side];
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
									onClick={() => props.onPlayer({ team: team.team, role })}
									className={`press relative cursor-pointer isolate flex min-h-[clamp(48px,7.8vh,88px)] w-full items-center gap-2 overflow-hidden border border-line bg-surface/50 px-2 text-left outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action aria-pressed:bg-action/10 aria-pressed:ring-2 aria-pressed:ring-action aria-pressed:ring-inset ${current ? `bg-surface shadow-[inset_2px_0_currentColor] ${style.text}` : ""}`}
								>
									{champion && (
										<span
											className={`pointer-events-none absolute inset-y-px right-px -z-10 w-3/5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_55%)] motion-safe:transition-opacity motion-safe:duration-300 ${current ? "opacity-50" : "opacity-100 motion-safe:starting:opacity-50"}`}
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
										<strong className="block truncate font-display text-[clamp(16px,1.4vw,23px)] leading-tight">
											{handle}
										</strong>
										{current && (
											<small className="block text-[11px]">
												{t("draft.board.yourPick")}
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
				className="mt-[3px] grid min-h-10 grid-cols-5 items-center gap-1 text-[13px] text-muted leading-[1.45]"
			>
				{team.bans.map((ban, index) => {
					if (!ban)
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
							<li key={index} className="truncate text-xs italic">
								{t("draft.board.noBan")}
							</li>
						);
					const label = championLabel(options, ban);
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
						<li key={index} className="flex">
							<Tooltip content={label}>
								<button
									type="button"
									data-card-champion={ban}
									aria-keyshortcuts="I"
									aria-label={label}
									className="flex cursor-pointer h-[clamp(37px,5.4vh,62px)] w-full rounded-control focus-visible:outline-action"
								>
									<ChampionPortrait
										id={ban}
										label={label}
										size="tile"
										unavailable
									/>
								</button>
							</Tooltip>
						</li>
					);
				})}
			</ul>
		</section>
	);
});
