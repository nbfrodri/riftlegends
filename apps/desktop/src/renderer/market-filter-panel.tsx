import { ROLES, type Role } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { RangeSlider } from "@rift-legends/ui-kit/components/range-slider";
import { SearchSelect } from "@rift-legends/ui-kit/components/search-select";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { X } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { RoleToggle } from "./champion-filters";
import {
	activeFilterKeys,
	clearFilter,
	EMPTY_FILTERS,
	type FilterKey,
	isPresetOn,
	type MarketFilters,
	PRESETS,
	type PresetContext,
	type Range,
	togglePreset,
} from "./market-filters";

// Market filter panel (#385): presets on top, one section per filter and
// "clear" at the bottom. The chips of the active filters live over the table.

export type Bounds = readonly [number, number];

const ANY = "any";
const ALL_TEAMS = "";

/** Slider value from a range; a thumb at its bound leaves that end open. */
export const toSlider = (range: Range, [low, high]: Bounds) =>
	[range.min ?? low, range.max ?? high] as const;
export const fromSlider = (
	[a, b]: [number, number],
	[low, high]: Bounds,
): Range => ({
	...(a > low && { min: a }),
	...(b < high && { max: b }),
});

/** A visible heading over a control that carries the same name itself. */
export function Section(props: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span aria-hidden className="text-muted">
				{props.label}
			</span>
			{props.children}
		</div>
	);
}

/** Segments share the panel width and keep each label on one line. */
export const segmentFill =
	"w-full [&>label]:flex-1 [&_span]:whitespace-nowrap [&_span]:px-1.5";

export const presetClass =
	"press cursor-pointer rounded-control border border-line bg-surface px-2 py-[3px] text-[13px] text-text hover:border-muted focus-visible:outline-2 focus-visible:outline-action aria-pressed:border-action aria-pressed:bg-action/15 aria-pressed:font-semibold";

export function MarketFilterPanel(props: {
	filters: MarketFilters;
	onChange: (filters: MarketFilters) => void;
	teams: readonly string[];
	age: Bounds;
	rating: Bounds;
	salary: Bounds;
	presets: PresetContext;
	formatSalary: (value: number) => string;
}) {
	const { t } = useTranslation();
	const headingId = useId();
	const { filters, onChange } = props;
	const set = <K extends FilterKey>(key: K, value: MarketFilters[K]) =>
		onChange({ ...filters, [key]: value });
	const toggleRole = (role: Role) =>
		set(
			"roles",
			filters.roles.includes(role)
				? filters.roles.filter((value) => value !== role)
				: [...filters.roles, role],
		);
	const slider = (
		key: "age" | "rating" | "salary",
		bounds: Bounds,
		labels: [string, string, string],
		extra?: { step: number; format: (value: number) => string },
	) => (
		<RangeSlider
			label={labels[0]}
			minLabel={labels[1]}
			maxLabel={labels[2]}
			min={bounds[0]}
			max={bounds[1]}
			step={extra?.step}
			format={extra?.format}
			value={toSlider(filters[key], bounds)}
			onChange={(value) => set(key, fromSlider(value, bounds))}
		/>
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
				{PRESETS.map((preset) => (
					<Tooltip key={preset} content={t(`market.preset.${preset}.hint`)}>
						<button
							type="button"
							aria-pressed={isPresetOn(filters, preset, props.presets)}
							onClick={() =>
								onChange(togglePreset(filters, preset, props.presets))
							}
							className={presetClass}
						>
							{t(`market.preset.${preset}`)}
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
			{slider("age", props.age, [
				t("market.filters.age"),
				t("market.filters.ageMin"),
				t("market.filters.ageMax"),
			])}
			{slider("rating", props.rating, [
				t("market.filters.rating"),
				t("market.filters.ratingMin"),
				t("market.filters.ratingMax"),
			])}
			<Section label={t("market.filters.form")}>
				<SegmentedControl
					label={t("market.filters.form")}
					options={[
						{ value: "up", label: t("market.filters.formUp") },
						{ value: ANY, label: t("market.filters.any") },
					]}
					value={filters.form ?? ANY}
					className={segmentFill}
					onChange={(value) => set("form", value === ANY ? null : "up")}
				/>
			</Section>
			<Section label={t("market.column.team")}>
				<SearchSelect
					label={t("market.column.team")}
					searchLabel={t("market.filters.teamSearch")}
					empty={t("market.filters.teamEmpty")}
					groups={[
						{
							items: [
								{ value: ALL_TEAMS, label: t("market.filters.anyTeam") },
								...props.teams.map((team) => ({ value: team, label: team })),
							],
						},
					]}
					value={filters.team ?? ALL_TEAMS}
					onChange={(team) => set("team", team === ALL_TEAMS ? null : team)}
					className="w-full"
				/>
			</Section>
			<Section label={t("market.filters.contract")}>
				<SegmentedControl
					label={t("market.filters.contract")}
					options={[
						{ value: "thisYear", label: t("market.contract.thisYear") },
						{ value: "nextYear", label: t("market.contract.nextYear") },
						{ value: ANY, label: t("market.filters.any") },
					]}
					value={filters.contract ?? ANY}
					className={segmentFill}
					onChange={(value) => set("contract", value === ANY ? null : value)}
				/>
			</Section>
			{slider(
				"salary",
				props.salary,
				[
					t("market.filters.salary"),
					t("market.filters.salaryMin"),
					t("market.filters.salaryMax"),
				],
				{ step: 100, format: props.formatSalary },
			)}
			<Button
				variant="ghost"
				disabled={activeFilterKeys(filters).length === 0}
				onClick={() => onChange(EMPTY_FILTERS)}
				className="mt-auto border border-line"
			>
				{t("market.filters.clear")}
			</Button>
		</aside>
	);
}

/** The active filters as chips over the table; each one removes itself. */
export function ActiveFilterChips(props: {
	filters: MarketFilters;
	onChange: (filters: MarketFilters) => void;
	formatSalary: (value: number) => string;
}) {
	const { t } = useTranslation();
	const { filters } = props;
	const active = activeFilterKeys(filters);
	if (active.length === 0) return null;
	const range = (
		{ min, max }: Range,
		format: (n: number) => string = String,
	) =>
		min !== undefined && max !== undefined
			? t("market.chip.between", { min: format(min), max: format(max) })
			: min !== undefined
				? t("market.chip.from", { min: format(min) })
				: t("market.chip.upTo", { max: format(max ?? 0) });
	const chip = (key: FilterKey) => {
		const [label, value] = {
			roles: [
				t("market.column.role"),
				filters.roles.map((role) => t(`market.role.${role}`)).join(", "),
			],
			age: [t("market.filters.age"), range(filters.age)],
			rating: [t("market.filters.rating"), range(filters.rating)],
			form: [t("market.filters.form"), t("market.form.up")],
			team: [t("market.column.team"), filters.team],
			contract: [
				t("market.filters.contract"),
				filters.contract && t(`market.contract.${filters.contract}`),
			],
			salary: [
				t("market.filters.salary"),
				range(filters.salary, props.formatSalary),
			],
		}[key];
		return t("market.chip", { label, value });
	};
	return (
		<FilterChipList
			chips={active.map((key) => ({ key, text: chip(key) }))}
			onRemove={(key) => props.onChange(clearFilter(filters, key))}
		/>
	);
}

/** Chips of the filters in use; each one removes itself. */
export function FilterChipList<Key extends string>(props: {
	chips: readonly { key: Key; text: string }[];
	onRemove: (key: Key) => void;
}) {
	const { t } = useTranslation();
	if (props.chips.length === 0) return null;
	return (
		<ul
			aria-label={t("market.filters.active")}
			className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-table"
		>
			{props.chips.map(({ key, text }) => (
				<li
					key={key}
					className="inline-flex items-center gap-1 rounded-control border border-line bg-surface ps-2 text-[13px]"
				>
					{text}
					<button
						type="button"
						aria-label={t("market.filters.remove", { filter: text })}
						onClick={() => props.onRemove(key)}
						className="press grid size-6 cursor-pointer place-items-center text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-action"
					>
						<X aria-hidden className="size-3.5" />
					</button>
				</li>
			))}
		</ul>
	);
}
