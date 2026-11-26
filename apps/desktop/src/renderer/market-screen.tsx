import {
	CellText,
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "./assets/game-role-icon";
import { levelColor, levelOf } from "./level-scale";
import { ActiveFilterChips, MarketFilterPanel } from "./market-filter-panel";
import {
	cheapSalaryMax,
	EMPTY_FILTERS,
	filterPlayers,
	type MarketFilters,
} from "./market-filters";
import {
	type PlaceholderPlayer,
	placeholderPlayers,
	placeholderToday,
} from "./placeholder-players";

const formTrend = (form: number) =>
	form > 0
		? { key: "up" as const, Icon: TrendingUp, color: "text-good" }
		: form < 0
			? { key: "down" as const, Icon: TrendingDown, color: "text-bad" }
			: { key: "flat" as const, Icon: Minus, color: "text-muted" };

const unique = (values: readonly string[]) =>
	[...new Set(values)].sort((a, b) => a.localeCompare(b));

const bounds = (values: readonly number[], step = 1) =>
	[
		Math.floor(Math.min(...values) / step) * step,
		Math.ceil(Math.max(...values) / step) * step,
	] as const;

/** A small button in a cell that filters the table by that cell's value. */
function CellFilter(props: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip content={props.label}>
			{/* Rows move with the arrow keys; the panel offers the same filters by keyboard. */}
			<button
				type="button"
				tabIndex={-1}
				onClick={props.onClick}
				className="press -mx-1 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-control px-1 align-middle hover:bg-panel hover:text-action"
			>
				{props.children}
			</button>
		</Tooltip>
	);
}

export function MarketScreen({
	players = placeholderPlayers,
	season = Number(placeholderToday.slice(0, 4)),
}: {
	/** The market rows; tests pass larger sets. */
	players?: readonly PlaceholderPlayer[];
	/** The current season, for "contract ends this year". */
	season?: number;
}) {
	const { t, i18n } = useTranslation();
	const language = i18n.language;
	const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS);
	const shown = useMemo(
		() => filterPlayers(players, filters, season),
		[players, filters, season],
	);
	const ranges = useMemo(
		() => ({
			teams: unique(players.map((p) => p.team)),
			age: bounds(players.map((p) => p.age)),
			rating: bounds(players.map((p) => p.rating)),
			salary: bounds(
				players.map((p) => p.salary),
				100,
			),
			presets: { cheapMax: cheapSalaryMax(players) },
		}),
		[players],
	);

	// Spanish skips the thousands separator on four digits unless forced,
	// which would misalign a right-aligned column.
	const euros = useMemo(
		() =>
			new Intl.NumberFormat(language, {
				style: "currency",
				currency: "EUR",
				maximumFractionDigits: 0,
				useGrouping: true,
			}),
		[language],
	);
	const formatSalary = (value: number) => euros.format(value);

	const columns = useMemo<DataTableColumn<PlaceholderPlayer>[]>(() => {
		const integer = new Intl.NumberFormat(language);
		const month = new Intl.DateTimeFormat(language, {
			month: "short",
			year: "numeric",
			timeZone: "UTC",
		});
		return [
			{
				id: "name",
				header: t("market.column.player"),
				value: (player) => player.name,
				width: "9rem",
			},
			{
				id: "role",
				header: t("market.column.role"),
				value: (player) => t(`market.role.${player.role}`),
				cell: (player) => {
					const role = t(`market.role.${player.role}`);
					return (
						<CellFilter
							label={t("market.filterBy", { value: role })}
							onClick={() =>
								setFilters((f) => ({ ...f, roles: [player.role] }))
							}
						>
							<GameRoleIcon role={player.role} size={16} />
							<CellText>{role}</CellText>
						</CellFilter>
					);
				},
				width: "6.5rem",
			},
			{
				id: "team",
				header: t("market.column.team"),
				value: (player) => player.team,
				cell: (player) => (
					<CellFilter
						label={t("market.filterBy", { value: player.team })}
						onClick={() => setFilters((f) => ({ ...f, team: player.team }))}
					>
						<CellText>{player.team}</CellText>
					</CellFilter>
				),
				width: "10rem",
			},
			{
				id: "age",
				header: t("market.column.age"),
				value: (player) => player.age,
				cell: (player) => integer.format(player.age),
				numeric: true,
				width: "4rem",
			},
			{
				id: "rating",
				header: t("market.column.rating"),
				value: (player) => player.rating,
				width: "4.5rem",
				// The player card scale (#360): color plus the level in words.
				cell: (player) => {
					const level = levelOf(player.rating);
					return (
						<span className={`font-semibold ${levelColor[level]}`}>
							{integer.format(player.rating)}
							<span className="sr-only">
								{" "}
								{t(`draft.board.level.${level}`)}
							</span>
						</span>
					);
				},
				numeric: true,
			},
			{
				id: "form",
				header: t("market.column.form"),
				value: (player) => player.form,
				width: "4.5rem",
				// No sign: the icon, the color and the words say the direction.
				cell: (player) => {
					const { key, Icon, color } = formTrend(player.form);
					return (
						<span className={`inline-flex items-center gap-1 ${color}`}>
							<Icon aria-hidden className="size-3.5" />
							{integer.format(Math.abs(player.form))}
							<span className="sr-only"> {t(`market.form.${key}`)}</span>
						</span>
					);
				},
				numeric: true,
			},
			{
				id: "contractEnd",
				header: t("market.column.contractEnd"),
				value: (player) => player.contractEnd,
				cell: (player) => month.format(new Date(player.contractEnd)),
				width: "7.5rem",
			},
			{
				id: "salary",
				header: t("market.column.salary"),
				value: (player) => player.salary,
				cell: (player) => euros.format(player.salary),
				numeric: true,
				width: "8.5rem",
			},
		];
	}, [t, language, euros]);

	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.4vh,18px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{t("shell.nav.market")}
			</h1>
			<div className="flex min-h-0 flex-1 gap-[clamp(10px,1vw,16px)]">
				<MarketFilterPanel
					filters={filters}
					onChange={setFilters}
					teams={ranges.teams}
					age={ranges.age}
					rating={ranges.rating}
					salary={ranges.salary}
					presets={ranges.presets}
					formatSalary={formatSalary}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<ActiveFilterChips
						filters={filters}
						onChange={setFilters}
						formatSalary={formatSalary}
					/>
					<DataTable
						className="min-h-0 flex-1"
						label={t("market.table.label")}
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
					/>
				</div>
			</div>
		</section>
	);
}
