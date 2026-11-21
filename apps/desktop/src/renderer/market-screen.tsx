import {
	DataTable,
	type DataTableColumn,
} from "@rift-legends/ui-kit/components/data-table";
import { RoleIcon } from "@rift-legends/ui-kit/components/role-icon";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	type PlaceholderPlayer,
	placeholderPlayers,
} from "./placeholder-players";

export function MarketScreen() {
	const { t, i18n } = useTranslation();
	const language = i18n.language;

	const columns = useMemo<DataTableColumn<PlaceholderPlayer>[]>(() => {
		const integer = new Intl.NumberFormat(language);
		const signed = new Intl.NumberFormat(language, {
			signDisplay: "exceptZero",
		});
		// Spanish skips the thousands separator on four digits unless forced,
		// which would misalign a right-aligned column.
		const euros = new Intl.NumberFormat(language, {
			style: "currency",
			currency: "EUR",
			maximumFractionDigits: 0,
			useGrouping: true,
		});
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
						<RoleIcon role={player.role} size={16} />
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
				cell: (player) => integer.format(player.rating),
				numeric: true,
			},
			{
				id: "form",
				header: t("market.column.form"),
				value: (player) => player.form,
				cell: (player) => signed.format(player.form),
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
	}, [t, language]);

	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.4vh,18px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{t("shell.nav.market")}
			</h1>
			<DataTable
				className="flex-1"
				label={t("market.table.label")}
				data={placeholderPlayers}
				columns={columns}
				getRowId={(player) => player.id}
				filterLabel={t("market.filter.label")}
				filterPlaceholder={t("market.filter.placeholder")}
				emptyText={t("market.empty")}
				countLabel={(shown, total) => t("market.count", { shown, total })}
				locale={language}
			/>
		</section>
	);
}
