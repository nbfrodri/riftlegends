import type { ContentDatabase } from "@rift-legends/contracts";
import { ROLES } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { LeagueLogo } from "../assets/league-logo";
import { PlayerPortrait } from "../draft/board/player-card";
import { TeamCrest } from "../draft/team-crest";
import type { DatabasePlayer } from "./database-filters";

type Team = ContentDatabase["teams"][number];

/** Starters first, each group in role order. */
const rosterOrder = (a: DatabasePlayer, b: DatabasePlayer) =>
	Number(a.sub) - Number(b.sub) ||
	ROLES.indexOf(a.role) - ROLES.indexOf(b.role);

/** Every team as a card: logo, league and seed, coach and roster (#443). */
export function TeamList({
	teams,
	players,
	onOpen,
}: {
	teams: readonly Team[];
	players: readonly DatabasePlayer[];
	onOpen: (player: DatabasePlayer, trigger: HTMLElement) => void;
}) {
	const { t } = useTranslation();
	return (
		<ul
			aria-label={t("database.teams.label")}
			className="m-0 grid min-h-0 flex-1 list-none auto-rows-min grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2 overflow-y-auto p-0"
		>
			{teams.map((team) => {
				const roster = players
					.filter((player) => player.team === team.id)
					.sort(rosterOrder);
				const headingId = `database-team-${team.id.replace(/\W/g, "-")}`;
				return (
					<li
						key={team.id}
						aria-labelledby={headingId}
						className="flex flex-col gap-2 bg-panel px-3 py-2.5"
					>
						<div className="flex items-center gap-3">
							<TeamCrest
								id={team.id}
								name={team.name}
								className="size-11 shrink-0"
							/>
							<div className="min-w-0">
								<h2
									id={headingId}
									className="truncate font-bold font-display text-[17px] tracking-heading"
								>
									{team.name}
								</h2>
								<p className="flex items-center gap-1.5 text-[13px] text-muted">
									{team.league && (
										<span aria-hidden="true">
											<LeagueLogo id={team.league} name={team.league} />
										</span>
									)}
									{team.league
										? t("draft.setup.leagueSeed", {
												league: team.league,
												n: team.seed,
											})
										: t("draft.setup.seed", { n: team.seed })}
								</p>
							</div>
						</div>
						<p className="text-[13px]">
							{t("database.team.coach", {
								name: team.coach.name,
								style: t(`draft.personality.${team.coach.personality}.name`),
							})}
						</p>
						<ul className="m-0 flex list-none flex-col gap-0.5 p-0">
							{roster.map((player) => (
								<li key={player.id}>
									<button
										type="button"
										onClick={(event) => onOpen(player, event.currentTarget)}
										className="press flex w-full cursor-pointer items-center gap-2 rounded-control px-1 py-0.5 text-left text-table hover:bg-surface focus-visible:outline-2 focus-visible:outline-action"
									>
										<PlayerPortrait
											id={player.id}
											handle={player.handle}
											size="h-7 w-6"
										/>
										<GameRoleIcon role={player.role} size={16} />
										<span className="min-w-0 flex-1 truncate font-semibold">
											{player.handle}
										</span>
										<span className="text-[12px] text-muted">
											{player.sub
												? t("database.status.sub")
												: t(`market.role.${player.role}`)}
										</span>
									</button>
								</li>
							))}
						</ul>
					</li>
				);
			})}
		</ul>
	);
}
