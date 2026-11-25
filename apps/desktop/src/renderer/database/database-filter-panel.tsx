import { ROLES, type Role } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { RangeSlider } from "@rift-legends/ui-kit/components/range-slider";
import {
	SearchSelect,
	type SearchSelectItem,
} from "@rift-legends/ui-kit/components/search-select";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { RoleToggle } from "../champion-filters";
import {
	type Bounds,
	FilterChipList,
	fromSlider,
	presetClass,
	Section,
	segmentFill,
	toSlider,
} from "../market-filter-panel";
import type { Range } from "../market-filters";
import {
	activeDatabaseFilters,
	DATABASE_PRESETS,
	type DatabaseFilterKey,
	type DatabaseFilters,
	EMPTY_DATABASE_FILTERS,
	isDatabasePresetOn,
	toggleDatabasePreset,
} from "./database-filters";

// The market's side panel (#385) over the database players (#443).

const ANY = "any";
const ALL = "";

export type FilterOptions = {
	leagues: readonly string[];
	/** Teams of the chosen league, or every team. */
	teams: readonly SearchSelectItem[];
	nationalities: readonly SearchSelectItem[];
	rating: Bounds;
};

function Choice(props: {
	label: string;
	searchLabel: string;
	anyLabel: string;
	items: readonly SearchSelectItem[];
	value: string | null;
	onChange: (value: string | null) => void;
}) {
	const { t } = useTranslation();
	return (
		<Section label={props.label}>
			<SearchSelect
				label={props.label}
				searchLabel={props.searchLabel}
				empty={t("database.filters.noMatch")}
				groups={[
					{ items: [{ value: ALL, label: props.anyLabel }, ...props.items] },
				]}
				value={props.value ?? ALL}
				onChange={(value) => props.onChange(value === ALL ? null : value)}
				className="w-full"
			/>
		</Section>
	);
}

export function DatabaseFilterPanel(props: {
	filters: DatabaseFilters;
	onChange: (filters: DatabaseFilters) => void;
	options: FilterOptions;
}) {
	const { t } = useTranslation();
	const headingId = useId();
	const { filters, onChange, options } = props;
	const set = <K extends DatabaseFilterKey>(
		key: K,
		value: DatabaseFilters[K],
	) => onChange({ ...filters, [key]: value });
	const toggleRole = (role: Role) =>
		set(
			"roles",
			filters.roles.includes(role)
				? filters.roles.filter((value) => value !== role)
				: [...filters.roles, role],
		);
	return (
		<aside
			aria-labelledby={headingId}
			className="flex w-[264px] shrink-0 flex-col gap-3 overflow-y-auto bg-panel px-3.5 py-3 text-table"
		>
			<h2
				id={headingId}
				className="font-bold font-display text-[17px] tracking-heading"
			>
				{t("market.filters.label")}
			</h2>
			{/* biome-ignore lint/a11y/useSemanticElements: a fieldset adds its own border and padding rules. */}
			<div
				role="group"
				aria-label={t("market.presets.label")}
				className="flex flex-wrap gap-1.5"
			>
				{DATABASE_PRESETS.map((preset) => (
					<Tooltip key={preset} content={t(`database.preset.${preset}.hint`)}>
						<button
							type="button"
							aria-pressed={isDatabasePresetOn(filters, preset)}
							onClick={() => onChange(toggleDatabasePreset(filters, preset))}
							// The shared class has the hand cursor; the guard reads it from here.
							className={`${presetClass} cursor-pointer`}
						>
							{t(`database.preset.${preset}`)}
						</button>
					</Tooltip>
				))}
			</div>
			<Section label={t("market.column.role")}>
				{/* biome-ignore lint/a11y/useSemanticElements: a fieldset adds its own border and padding rules. */}
				<div
					role="group"
					aria-label={t("market.column.role")}
					className="flex gap-1"
				>
					{ROLES.map((role) => (
						<RoleToggle
							key={role}
							role={role}
							label={t(`market.role.${role}`)}
							pressed={filters.roles.includes(role)}
							onClick={() => toggleRole(role)}
						/>
					))}
				</div>
			</Section>
			<RangeSlider
				label={t("market.filters.rating")}
				minLabel={t("market.filters.ratingMin")}
				maxLabel={t("market.filters.ratingMax")}
				min={options.rating[0]}
				max={options.rating[1]}
				value={toSlider(filters.rating, options.rating)}
				onChange={(value) => set("rating", fromSlider(value, options.rating))}
			/>
			<Section label={t("database.filters.status")}>
				<SegmentedControl
					label={t("database.filters.status")}
					options={[
						{ value: "starter", label: t("database.status.starter") },
						{ value: "sub", label: t("database.status.sub") },
						{ value: ANY, label: t("market.filters.any") },
					]}
					value={filters.status ?? ANY}
					className={segmentFill}
					onChange={(value) => set("status", value === ANY ? null : value)}
				/>
			</Section>
			<Choice
				label={t("database.column.league")}
				searchLabel={t("database.filters.leagueSearch")}
				anyLabel={t("database.filters.anyLeague")}
				items={options.leagues.map((league) => ({
					value: league,
					label: league,
				}))}
				value={filters.league}
				// A team of another league would leave the list empty.
				onChange={(league) => onChange({ ...filters, league, team: null })}
			/>
			<Choice
				label={t("market.column.team")}
				searchLabel={t("market.filters.teamSearch")}
				anyLabel={t("market.filters.anyTeam")}
				items={options.teams}
				value={filters.team}
				onChange={(team) => set("team", team)}
			/>
			<Choice
				label={t("database.column.nationality")}
				searchLabel={t("database.filters.nationalitySearch")}
				anyLabel={t("database.filters.anyNationality")}
				items={options.nationalities}
				value={filters.nationality}
				onChange={(nationality) => set("nationality", nationality)}
			/>
			<Button
				variant="ghost"
				disabled={activeDatabaseFilters(filters).length === 0}
				onClick={() => onChange(EMPTY_DATABASE_FILTERS)}
				className="mt-auto border border-line"
			>
				{t("market.filters.clear")}
			</Button>
		</aside>
	);
}

/** The database filters in use as chips over the table. */
export function DatabaseFilterChips(props: {
	filters: DatabaseFilters;
	onChange: (filters: DatabaseFilters) => void;
	labelOf: {
		team: (id: string) => string;
		nationality: (code: string) => string;
	};
}) {
	const { t } = useTranslation();
	const { filters } = props;
	const range = ({ min, max }: Range) =>
		min !== undefined && max !== undefined
			? t("market.chip.between", { min, max })
			: min !== undefined
				? t("market.chip.from", { min })
				: t("market.chip.upTo", { max });
	const text = (key: DatabaseFilterKey) => {
		const [label, value] = {
			roles: [
				t("market.column.role"),
				filters.roles.map((role) => t(`market.role.${role}`)).join(", "),
			],
			rating: [t("market.filters.rating"), range(filters.rating)],
			league: [t("database.column.league"), filters.league],
			team: [t("market.column.team"), props.labelOf.team(filters.team ?? "")],
			nationality: [
				t("database.column.nationality"),
				props.labelOf.nationality(filters.nationality ?? ""),
			],
			status: [
				t("database.filters.status"),
				filters.status && t(`database.status.${filters.status}`),
			],
		}[key];
		return t("market.chip", { label, value });
	};
	return (
		<FilterChipList
			chips={activeDatabaseFilters(filters).map((key) => ({
				key,
				text: text(key),
			}))}
			onRemove={(key) =>
				props.onChange({ ...filters, [key]: EMPTY_DATABASE_FILTERS[key] })
			}
		/>
	);
}
