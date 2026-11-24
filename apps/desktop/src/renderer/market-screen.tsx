import {
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "./assets/game-role-icon";
import { levelColor, levelOf } from "./level-scale";
import { MarketFilterBar } from "./market-filter-bar";
import {
	contractYear,
	EMPTY_FILTERS,
	filterPlayers,
	type MarketFilters,
} from "./market-filters";
import {
	type PlaceholderPlayer,
	placeholderPlayers,
} from "./placeholder-players";

const formTrend = (form: number) =>
	form > 0
		? { key: "up" as const, Icon: TrendingUp, color: "text-good" }
		: form < 0
			? { key: "down" as const, Icon: TrendingDown, color: "text-bad" }
			: { key: "flat" as const, Icon: Minus, color: "text-muted" };

const unique = <T,>(values: readonly T[]) =>
	[...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

export function MarketScreen({
	players = placeholderPlayers,
}: {
	/** The market rows; tests pass larger sets. */
	players?: readonly PlaceholderPlayer[];
}) {
	const { t, i18n } = useTranslation();
	const language = i18n.language;
	const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS);
	const shown = useMemo(
		() => filterPlayers(players, filters),
		[players, filters],
	);
	const teams = useMemo(() => unique(players.map((p) => p.team)), [players]);
	const years = useMemo(() => unique(players.map(contractYear)), [players]);

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
			},
			{
				id: "role",
				header: t("market.column.role"),
				value: (player) => t(`market.role.${player.role}`),
				cell: (player) => (
					<span className="inline-flex items-center gap-2 align-middle">
						<GameRoleIcon role={player.role} size={16} />
						{t(`market.role.${player.role}`)}
					</span>
				),
			},
			{
				id: "team",
				header: t("market.column.team"),
				value: (player) => player.team,
			},
			{
				id: "age",
				header: t("market.column.age"),
				value: (player) => player.age,
				cell: (player) => integer.format(player.age),
				numeric: true,
			},
			{
				id: "rating",
				header: t("market.column.rating"),
				value: (player) => player.rating,
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
			},
			{
				id: "salary",
				header: t("market.column.salary"),
				value: (player) => player.salary,
				cell: (player) => euros.format(player.salary),
				numeric: true,
			},
		];
	}, [t, language, euros]);

	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.4vh,18px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{t("shell.nav.market")}
			</h1>
			<MarketFilterBar
				filters={filters}
				onChange={setFilters}
				teams={teams}
				years={years}
				formatSalary={formatSalary}
			/>
			<DataTable
				className="flex-1"
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
		</section>
	);
}
