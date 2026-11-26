import type { StandingsView } from "@rift-legends/contracts";
import {
	CellText,
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import { stageName } from "../names";
import {
	destinationsOf,
	destinationText,
	type Group,
	signed,
	tieText,
} from "./standings-text";

// League and group standings of a stage (plan 31, U3): one DataTable per
// table, with the place each team leads to and, on its place, why a tie went
// the way it did (Caja tooltip; the same words for screen readers).

type Row = StandingsView["rows"][number];
type Destination = StandingsView["destinations"][number];

const GROUPS: readonly Group[] = ["winner", "loser"];

export function StandingsTables({
	standings,
	stage,
	teamName,
}: {
	standings: StandingsView;
	stage: string;
	teamName: (id: string) => string;
}) {
	const { t } = useTranslation();
	const { groups, destinations } = standings;
	if (!groups)
		return (
			<StandingsTable
				label={t("competition.standings.label", { stage: stageName(stage) })}
				rows={standings.rows}
				destinations={destinationsOf(destinations)}
				showDestination={destinations.length > 0}
				teamName={teamName}
			/>
		);
	return (
		<div className="grid min-h-0 flex-1 grid-rows-2 gap-[clamp(10px,1.6vh,20px)]">
			{GROUPS.map((group) => {
				const label = t(`competition.standings.group.${group}`);
				return (
					<section
						key={group}
						aria-label={label}
						className="flex min-h-0 flex-col gap-1.5"
					>
						<header className="flex items-baseline justify-between gap-3">
							<h3 className="font-bold font-display text-[clamp(14px,1.2vw,19px)] tracking-[-0.045em]">
								{label}
							</h3>
							<span className="text-muted tabular-nums">
								{t("competition.standings.points", {
									count: groups[group].points,
								})}
							</span>
						</header>
						<StandingsTable
							label={label}
							rows={groups[group].rows}
							destinations={destinationsOf(destinations, group)}
							showDestination={destinations.length > 0}
							teamName={teamName}
						/>
					</section>
				);
			})}
		</div>
	);
}

function StandingsTable({
	label,
	rows,
	destinations,
	showDestination,
	teamName,
}: {
	label: string;
	rows: readonly Row[];
	destinations: readonly Destination[];
	showDestination: boolean;
	teamName: (id: string) => string;
}) {
	const { t, i18n } = useTranslation();
	const language = i18n.language;
	const columns = useMemo<DataTableColumn<Row>[]>(() => {
		const order = rows.map(({ team }) => team);
		const record = (wins: number, losses: number) =>
			t("competition.record", { wins, losses });
		const all: DataTableColumn<Row>[] = [
			{
				id: "rank",
				header: "#",
				value: (row) => row.rank,
				cell: (row) => (
					<Place row={row} tie={tieText(t, language, row, order, teamName)} />
				),
				width: "3.5rem",
			},
			{
				id: "team",
				header: t("competition.standings.column.team"),
				value: (row) => teamName(row.team),
				cell: (row) => (
					<span className="inline-flex max-w-full items-center gap-2 align-middle font-semibold">
						<TeamCrest
							id={row.team}
							name={teamName(row.team)}
							className="size-5 shrink-0"
						/>
						<CellText>{teamName(row.team)}</CellText>
					</span>
				),
			},
			{
				id: "series",
				header: t("competition.standings.column.series"),
				value: (row) => row.seriesWins,
				cell: (row) => record(row.seriesWins, row.seriesLosses),
				numeric: true,
				width: "5.5rem",
			},
			{
				id: "games",
				header: t("competition.standings.column.games"),
				value: (row) => row.gameWins,
				cell: (row) => record(row.gameWins, row.gameLosses),
				numeric: true,
				width: "5.5rem",
			},
			{
				id: "diff",
				header: t("competition.standings.column.diff"),
				value: (row) => row.gameWins - row.gameLosses,
				cell: (row) => signed(row.gameWins - row.gameLosses),
				numeric: true,
				width: "4.5rem",
			},
			{
				id: "destination",
				header: t("competition.standings.column.destination"),
				value: (row) => destinationText(t, language, destinations, row.rank),
				width: "clamp(10rem, 22vw, 22rem)",
			},
		];
		return showDestination ? all : all.slice(0, -1);
	}, [rows, destinations, showDestination, t, language, teamName]);
	return (
		<DataTable
			className="min-h-0 flex-1"
			label={label}
			data={rows}
			columns={columns}
			getRowId={(row) => row.team}
			filterLabel={t("market.filter.label")}
			filterPlaceholder={t("competition.standings.filter")}
			emptyText={t("competition.standings.empty")}
			countLabel={(shown) =>
				t("competition.standings.count", { shown, total: rows.length })
			}
			locale={language}
		/>
	);
}

/** The place; a tied one carries why in the tooltip and for screen readers. */
function Place({
	row,
	tie,
}: {
	row: Row;
	tie: { heading: string; content: string } | undefined;
}) {
	if (!tie) return <span className="tabular-nums">{row.rank}</span>;
	return (
		<Tooltip heading={tie.heading} content={tie.content}>
			<span className="inline-flex items-center gap-1 tabular-nums">
				{row.rank}
				<Info aria-hidden className="size-3 text-muted" />
				<span className="sr-only">
					{tie.heading}. {tie.content}
				</span>
			</span>
		</Tooltip>
	);
}
