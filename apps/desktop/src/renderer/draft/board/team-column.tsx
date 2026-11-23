import {
	type DraftView,
	ROLES,
	type Role,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { ChampionPortrait } from "../champion-portrait";
import { championLabel, teamName } from "../session";
import { TeamCrest } from "../team-crest";
import { pickRows } from "./champions";

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
 * placed in it, and its bans as greyed portraits. Hovering or focusing a row
 * shows its player.
 */
export const TeamColumn = memo(function TeamColumn(props: {
	side: Side;
	first: boolean;
	team: DraftView[Side];
	options: SeriesOptions;
	/** Index of the pick the user is choosing now, if any; it shows in the first free row. */
	current: number | null;
	onPlayer: (player: PlayerRef) => void;
}) {
	const { t } = useTranslation();
	const { options, team } = props;
	const name = teamName(options, team.team);
	const players = options.teams.find(({ id }) => id === team.team)?.players;
	const rows = pickRows(
		team.picks,
		(id) =>
			options.champions.find((champion) => champion.id === id)?.roles ?? [],
	);
	const choosing =
		props.current === null ? -1 : rows.findIndex((pick) => pick === null);
	const id = useId();
	const style = SIDE[props.side];
	return (
		<section
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
					<h2
						id={`${id}-team`}
						title={name}
						className="truncate font-bold font-display text-[29px] text-text leading-tight tracking-heading"
					>
						{name}
					</h2>
				</div>
				<span className="shrink-0 [&_img]:h-12 [&_img]:w-16 [&_svg]:h-12 [&_svg]:w-16">
					<TeamCrest id={team.team} name={name} />
				</span>
			</header>
			<ol className="my-[7px] grid flex-1 auto-rows-fr">
				{ROLES.map((role, row) => {
					const current = row === choosing;
					const pick = current ? props.current : rows[row];
					const champion = pick == null ? undefined : team.picks[pick];
					const player = { team: team.team, role };
					const show = () => props.onPlayer(player);
					const label = champion
						? championLabel(options, champion)
						: current
							? t("draft.board.yourPick")
							: t("draft.board.pending");
					const handle = players?.find((p) => p.role === role)?.handle;
					return (
						<li key={role} className="flex">
							<button
								type="button"
								aria-controls="player-card"
								onMouseEnter={show}
								onFocus={show}
								onClick={show}
								className={`flex w-full items-center gap-2.5 border-line border-b px-1 py-[3px] text-left hover:bg-surface ${current ? `bg-surface shadow-[inset_2px_0_currentColor] ${style.text}` : ""}`}
							>
								<span className="w-6 text-[12px] text-muted">
									{pick != null && `${style.letter}${pick + 1}`}
								</span>
								<span className={style.text}>
									<GameRoleIcon role={role} />
								</span>
								{champion && <ChampionPortrait id={champion} size="compact" />}
								<span className="min-w-0">
									<strong className="block truncate" title={label}>
										{label}
									</strong>
									<small
										className="block truncate text-[12px] text-muted"
										title={handle}
									>
										{handle}
									</small>
								</span>
							</button>
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
				className="mt-[3px] flex min-h-8 flex-wrap items-center gap-1.5 text-[13px] text-muted leading-[1.45]"
			>
				{team.bans.map((ban, index) => {
					if (!ban)
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
							<li key={index} className="italic">
								{t("draft.board.noBan")}
							</li>
						);
					const label = championLabel(options, ban);
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
						<li key={index} title={label} className="flex">
							<ChampionPortrait id={ban} label={label} size="ban" unavailable />
						</li>
					);
				})}
			</ul>
		</section>
	);
});
