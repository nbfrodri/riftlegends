import type { ContentDatabase } from "@rift-legends/contracts";
import {
	CellText,
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { LeagueLogo } from "../assets/league-logo";
import { PlayerPortrait } from "../draft/board/player-card";
import { CountryFlag } from "../draft/country-flag";
import { TeamCrest } from "../draft/team-crest";
import { levelColor, levelOf } from "../level-scale";
import { PlayerAge, playerAge } from "../player-age";
import {
	DatabaseFilterChips,
	DatabaseFilterPanel,
} from "./database-filter-panel";
import {
	type DatabaseFilters,
	type DatabasePlayer,
	EMPTY_DATABASE_FILTERS,
	filterDatabasePlayers,
} from "./database-filters";

type Team = ContentDatabase["teams"][number];

function TeamCell({ id, name }: { id: string; name: string }) {
	return (
		<span className="inline-flex max-w-full items-center gap-2 align-middle">
			<TeamCrest id={id} name={name} className="size-5 shrink-0" />
			<CellText>{name}</CellText>
		</span>
	);
}

function LeagueCell({ league }: { league?: string | undefined }) {
	if (!league) return null;
	return (
		<span className="inline-flex max-w-full items-center gap-2 align-middle">
			<span aria-hidden="true" className="shrink-0">
				<LeagueLogo id={league} name={league} />
			</span>
			<CellText>{league}</CellText>
		</span>
	);
}

const unique = (values: readonly string[]) => [...new Set(values)];

/** Every player with the market's filter panel (#385); a row opens the card. */
export function PlayerTable({
	players,
	teams,
	onOpen,
}: {
	players: readonly DatabasePlayer[];
	teams: readonly Team[];
	onOpen: (player: DatabasePlayer, trigger: HTMLElement | null) => void;
}) {
	const { t, i18n } = useTranslation();
	const language = i18n.language;
	const [filters, setFilters] = useState<DatabaseFilters>(
		EMPTY_DATABASE_FILTERS,
	);
	const shown = useMemo(
		() => filterDatabasePlayers(players, filters),
		[players, filters],
	);
	const countries = useMemo(
		() => new Intl.DisplayNames(language, { type: "region", fallback: "code" }),
		[language],
	);
	const country = useCallback(
		(code?: string) => (code ? (countries.of(code) ?? code) : ""),
		[countries],
	);
	const options = useMemo(() => {
		const levels = players.map((p) => p.level);
		return {
			leagues: unique(teams.flatMap((team) => team.league ?? [])),
			teams: teams
				.filter((team) => !filters.league || team.league === filters.league)
				.map((team) => ({ value: team.id, label: team.name })),
			nationalities: unique(players.flatMap((p) => p.nationality ?? []))
				.map((code) => ({ value: code, label: country(code) }))
				.sort((a, b) => a.label.localeCompare(b.label, language)),
			rating: [Math.min(...levels), Math.max(...levels)] as const,
		};
	}, [players, teams, filters.league, language, country]);

	const columns = useMemo<DataTableColumn<DatabasePlayer>[]>(
		() => [
			{
				id: "player",
				header: t("market.column.player"),
				value: (player) => player.handle,
				cell: (player) => (
					<span className="inline-flex max-w-full items-center gap-2 align-middle font-semibold">
						<PlayerPortrait
							id={player.id}
							handle={player.handle}
							size="h-[22px] w-[18px]"
						/>
						<CellText>{player.handle}</CellText>
					</span>
				),
				width: "8rem",
			},
			{
				id: "nationality",
				header: t("database.column.nationality"),
				value: (player) => country(player.nationality),
				cell: (player) => (
					<span className="inline-flex max-w-full items-center gap-2 align-middle">
						<CountryFlag country={player.nationality} />
						<CellText>{country(player.nationality)}</CellText>
					</span>
				),
				width: "7.75rem",
			},
			{
				id: "age",
				header: t("database.column.age"),
				// Unknown ages sort last when ascending.
				value: (player) =>
					playerAge(player.birthDate) ?? Number.MAX_SAFE_INTEGER,
				cell: (player) => <PlayerAge birthDate={player.birthDate} />,
				numeric: true,
				width: "4.75rem",
			},
			{
				id: "role",
				header: t("market.column.role"),
				value: (player) => t(`market.role.${player.role}`),
				cell: (player) => (
					<span className="inline-flex max-w-full items-center gap-2 align-middle">
						<GameRoleIcon role={player.role} size={16} />
						<CellText>{t(`market.role.${player.role}`)}</CellText>
					</span>
				),
				width: "6rem",
			},
			{
				id: "team",
				header: t("market.column.team"),
				value: (player) => player.teamName,
				cell: (player) => <TeamCell id={player.team} name={player.teamName} />,
				width: "9.5rem",
			},
			{
				id: "league",
				header: t("database.column.league"),
				value: (player) => player.league ?? "",
				cell: (player) => <LeagueCell league={player.league} />,
				width: "5.5rem",
			},
			{
				id: "rating",
				header: t("market.column.rating"),
				value: (player) => player.level,
				cell: (player) => {
					const level = levelOf(player.level);
					return (
						<span className={`font-semibold ${levelColor[level]}`}>
							{player.level}
							<span className="sr-only">
								{" "}
								{t(`draft.board.level.${level}`)}
							</span>
						</span>
					);
				},
				numeric: true,
				width: "4.75rem",
			},
		],
		[t, country],
	);

	const teamName = (id: string) =>
		teams.find((team) => team.id === id)?.name ?? id;

	return (
		<div className="flex min-h-0 flex-1 gap-[clamp(10px,1vw,16px)]">
			<DatabaseFilterPanel
				filters={filters}
				onChange={setFilters}
				options={options}
			/>
			<section
				aria-label={t("database.tab.players")}
				className="flex min-w-0 flex-1 flex-col gap-2"
			>
				<DatabaseFilterChips
					filters={filters}
					onChange={setFilters}
					labelOf={{ team: teamName, nationality: country }}
				/>
				<DataTable
					className="min-h-0 flex-1"
					label={t("database.players.label")}
					data={shown}
					columns={columns}
					getRowId={(player) => player.id}
					filterLabel={t("market.filter.label")}
					filterPlaceholder={t("market.filter.placeholder")}
					emptyText={t("market.empty")}
					countLabel={(count) =>
						t("market.count", { shown: count, total: players.length })
					}
					locale={language}
					onRowActivate={(player) =>
						onOpen(
							player,
							document.activeElement instanceof HTMLElement
								? document.activeElement
								: null,
						)
					}
					rowActionLabel={() => t("database.openCard")}
				/>
			</section>
		</div>
	);
}

/** Every coach: team, league, draft style and level, from the content. */
export function CoachTable({ teams }: { teams: readonly Team[] }) {
	const { t, i18n } = useTranslation();
	const columns = useMemo<DataTableColumn<Team>[]>(() => {
		const tenths = new Intl.NumberFormat(i18n.language, {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
		});
		return [
			{
				id: "coach",
				header: t("database.column.coach"),
				value: (team) => team.coach.name,
				cell: (team) => (
					<span className="font-semibold">{team.coach.name}</span>
				),
				width: "9.5rem",
			},
			{
				id: "team",
				header: t("market.column.team"),
				value: (team) => team.name,
				cell: (team) => <TeamCell id={team.id} name={team.name} />,
				width: "9.5rem",
			},
			{
				id: "league",
				header: t("database.column.league"),
				value: (team) => team.league ?? "",
				cell: (team) => <LeagueCell league={team.league} />,
				width: "5.5rem",
			},
			{
				id: "style",
				header: t("database.column.style"),
				value: (team) => t(`draft.personality.${team.coach.personality}.name`),
				width: "11rem",
			},
			{
				id: "level",
				header: t("draft.coach.level"),
				value: (team) => team.coach.rating,
				cell: (team) =>
					t("draft.coach.levelValue", {
						value: tenths.format(team.coach.rating / 10),
					}),
				numeric: true,
				width: "6.5rem",
			},
		];
	}, [t, i18n.language]);
	return (
		<section
			aria-label={t("database.tab.coaches")}
			className="flex min-h-0 flex-1 flex-col"
		>
			<DataTable
				className="min-h-0 flex-1"
				label={t("database.coaches.label")}
				data={teams}
				columns={columns}
				getRowId={(team) => team.id}
				filterLabel={t("market.filter.label")}
				filterPlaceholder={t("database.coaches.placeholder")}
				emptyText={t("database.coaches.empty")}
				countLabel={(count) =>
					t("database.coaches.count", { shown: count, total: teams.length })
				}
				locale={i18n.language}
			/>
		</section>
	);
}
