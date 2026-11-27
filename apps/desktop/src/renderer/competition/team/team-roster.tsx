import {
	CellText,
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { PlayerPortrait } from "../../draft/board/player-card";
import { CountryFlag } from "../../draft/country-flag";
import { levelColor, levelOf } from "../../level-scale";
import type { TeamProfile } from "./team-text";

// The roster with each player's season: photo (silhouette without one), flag,
// role, level on the shared color scale, games and K/D/A.

type Player = TeamProfile["players"][number];
type Line = TeamProfile["stats"]["players"][number];
type Row = Player & { line: Line | undefined };

export function TeamRoster({ profile }: { profile: TeamProfile }) {
	const { t, i18n } = useTranslation();
	const rows = useMemo<Row[]>(
		() =>
			[...profile.players]
				.sort((a, b) => Number(a.sub) - Number(b.sub))
				.map((player) => ({
					...player,
					line: profile.stats.players.find((line) => line.player === player.id),
				})),
		[profile],
	);
	const columns = useMemo<DataTableColumn<Row>[]>(
		() => [
			{
				id: "player",
				header: t("competition.team.column.player"),
				value: (row) => row.handle,
				cell: (row) => (
					<span className="inline-flex max-w-full items-center gap-2 align-middle">
						<PlayerPortrait
							id={row.id}
							handle={row.handle}
							size="h-[clamp(30px,5vh,44px)] w-[clamp(24px,4vh,35px)]"
						/>
						<CountryFlag country={row.nationality} />
						<CellText>
							<span className="font-semibold">{row.handle}</span>
						</CellText>
						{row.sub && (
							<span className="text-[12px] text-muted">
								{t("database.status.sub")}
							</span>
						)}
					</span>
				),
			},
			{
				id: "role",
				header: t("market.column.role"),
				value: (row) => row.role,
				cell: (row) => (
					<span className="inline-flex items-center gap-1.5 align-middle">
						<GameRoleIcon role={row.role} size={16} />
						{t(`market.role.${row.role}`)}
					</span>
				),
				width: "7.5rem",
			},
			{
				id: "level",
				header: t("competition.team.column.level"),
				value: (row) => row.level,
				cell: (row) => {
					const level = levelOf(row.level);
					return (
						<span className={`font-semibold ${levelColor[level]}`}>
							{row.level}
							<span className="sr-only">
								{" "}
								{t(`draft.board.level.${level}`)}
							</span>
						</span>
					);
				},
				numeric: true,
				width: "4.5rem",
			},
			{
				id: "games",
				header: t("competition.standings.column.games"),
				value: (row) => row.line?.games ?? 0,
				numeric: true,
				width: "4.5rem",
			},
			{
				id: "kda",
				header: t("competition.team.column.kda"),
				value: (row) => (row.line ? kdaRatio(row.line) : -1),
				cell: (row) =>
					row.line
						? `${row.line.kills}/${row.line.deaths}/${row.line.assists}`
						: "—",
				numeric: true,
				width: "7rem",
			},
		],
		[t],
	);
	return (
		<DataTable
			className="min-h-0 flex-1"
			rowHeight="h-[clamp(36px,6vh,52px)]"
			label={t("competition.team.roster")}
			data={rows}
			columns={columns}
			getRowId={(row) => row.id}
			filterable={false}
			emptyText={t("competition.team.empty")}
			locale={i18n.language}
		/>
	);
}

/** Sorts K/D/A by (kills + assists) per death. */
const kdaRatio = ({ kills, deaths, assists }: Line) =>
	(kills + assists) / Math.max(deaths, 1);
