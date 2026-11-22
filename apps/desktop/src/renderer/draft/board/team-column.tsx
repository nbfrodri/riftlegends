import type { Role, Side } from "@rift-legends/contracts";
import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { championLabel, useDraftSession } from "../session";
import { TeamCrest } from "../team-crest";

export interface PlayerRef {
	team: string;
	role: Role;
}

const SIDE = {
	blue: { letter: "B", text: "text-side-blue", border: "border-side-blue" },
	red: { letter: "R", text: "text-side-red", border: "border-side-red" },
} as const;

/**
 * A side of the draft: its five picks (with the role and player each slot
 * shows) and its bans, struck. Hovering or focusing a slot shows its player.
 */
export function TeamColumn(props: {
	side: Side;
	team: { id: string; name: string };
	picks: readonly string[];
	bans: readonly (string | null)[];
	roles: readonly Role[];
	/** Index of the slot the user is picking now, if any. */
	current: number | null;
	onPlayer: (player: PlayerRef) => void;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
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
				<div>
					<p
						id={`${id}-side`}
						className="font-semibold text-[12px] uppercase tracking-[0.055em]"
					>
						{t(`draft.side.${props.side}`)}
					</p>
					<h2
						id={`${id}-team`}
						className="font-bold font-display text-[29px] text-text leading-tight tracking-heading"
					>
						{props.team.name}
					</h2>
				</div>
				<span className="[&_svg]:h-12 [&_svg]:w-16">
					<TeamCrest id={props.team.id} name={props.team.name} />
				</span>
			</header>
			<ol className="my-[7px] grid flex-1 auto-rows-fr">
				{props.roles.map((role, index) => {
					const champion = props.picks[index];
					const current = index === props.current;
					const player = { team: props.team.id, role };
					const show = () => props.onPlayer(player);
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
									{style.letter}
									{index + 1}
								</span>
								<span className={style.text}>
									<GameRoleIcon role={role} />
								</span>
								{champion && <ChampionFace id={champion} size="compact" />}
								<span className="min-w-0">
									<strong className="block truncate">
										{champion
											? championLabel(options, champion)
											: current
												? t("draft.board.yourPick")
												: t("draft.board.pending")}
									</strong>
									<small className="block text-[12px] text-muted">
										{
											options.teams
												.find((team) => team.id === props.team.id)
												?.players.find((p) => p.role === role)?.handle
										}
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
				className="mt-[3px] flex min-h-[1.45em] flex-wrap gap-x-2.5 text-[13px] text-muted leading-[1.45]"
			>
				{props.bans.map((ban, index) =>
					ban ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
						<li key={index} className="max-w-full truncate">
							<s>{championLabel(options, ban)}</s>
						</li>
					) : (
						// biome-ignore lint/suspicious/noArrayIndexKey: bans only grow, in order.
						<li key={index} className="italic">
							{t("draft.board.noBan")}
						</li>
					),
				)}
			</ul>
		</section>
	);
}
