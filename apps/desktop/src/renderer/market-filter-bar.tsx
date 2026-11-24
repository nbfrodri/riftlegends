import { ROLES, type Role } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { X } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { RoleToggle } from "./champion-filters";
import {
	activeFilterKeys,
	clearFilter,
	EMPTY_FILTERS,
	type FilterKey,
	type MarketFilters,
	type Range,
} from "./market-filters";

// Filter bar of the market (#385): role toggles, selects and number boxes,
// then the active filters as chips that remove themselves.

const ANY = "any";
const field =
	"h-7 rounded-control border border-line bg-surface px-2 text-text placeholder:text-muted hover:border-muted focus-visible:border-action";

const parse = (text: string) => (text === "" ? undefined : Number(text));

function NumberBox(props: {
	label: string;
	placeholder: string;
	value: number | undefined;
	onChange: (value: number | undefined) => void;
	step?: number;
	className?: string;
}) {
	return (
		<input
			type="number"
			inputMode="numeric"
			min={0}
			step={props.step ?? 1}
			aria-label={props.label}
			placeholder={props.placeholder}
			value={props.value ?? ""}
			onChange={(event) => props.onChange(parse(event.target.value))}
			className={`${field} tabular-nums ${props.className ?? "w-16"}`}
		/>
	);
}

function RangeField(props: {
	label: string;
	minLabel: string;
	maxLabel: string;
	value: Range;
	onChange: (value: Range) => void;
}) {
	const { t } = useTranslation();
	const id = useId();
	const set = (end: keyof Range, value: number | undefined) => {
		const next = { ...props.value };
		if (value === undefined) delete next[end];
		else next[end] = value;
		props.onChange(next);
	};
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset would break the one-line bar.
		<div role="group" aria-labelledby={id} className="flex items-center gap-1">
			<span id={id} className="me-1 text-muted">
				{props.label}
			</span>
			<NumberBox
				label={props.minLabel}
				placeholder={t("market.filters.min")}
				value={props.value.min}
				onChange={(value) => set("min", value)}
			/>
			<span aria-hidden className="text-muted">
				–
			</span>
			<NumberBox
				label={props.maxLabel}
				placeholder={t("market.filters.max")}
				value={props.value.max}
				onChange={(value) => set("max", value)}
			/>
		</div>
	);
}

function OptionSelect(props: {
	label: string;
	anyLabel: string;
	options: readonly string[];
	value: string | null;
	onChange: (value: string | null) => void;
}) {
	const items = [
		{ value: ANY, label: props.anyLabel },
		...props.options.map((value) => ({ value, label: value })),
	];
	return (
		<div className="flex items-center gap-2">
			{/* The control carries the same name; this is the visible label. */}
			<span aria-hidden className="text-muted">
				{props.label}
			</span>
			<Select
				items={items}
				value={props.value ?? ANY}
				onValueChange={(value) =>
					props.onChange(value === ANY || value === null ? null : value)
				}
			>
				<SelectTrigger aria-label={props.label} className="h-7">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

export function MarketFilterBar(props: {
	filters: MarketFilters;
	onChange: (filters: MarketFilters) => void;
	teams: readonly string[];
	years: readonly number[];
	formatSalary: (value: number) => string;
}) {
	const { t } = useTranslation();
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

	const range = ({ min, max }: Range) =>
		min !== undefined && max !== undefined
			? t("market.chip.between", { min, max })
			: min !== undefined
				? t("market.chip.from", { min })
				: t("market.chip.upTo", { max });
	const chip = (key: FilterKey) => {
		const [label, value] = {
			roles: [
				t("market.column.role"),
				filters.roles.map((role) => t(`market.role.${role}`)).join(", "),
			],
			team: [t("market.column.team"), filters.team],
			age: [t("market.filters.age"), range(filters.age)],
			rating: [t("market.filters.rating"), range(filters.rating)],
			contractUntil: [
				t("market.column.contractEnd"),
				t("market.chip.upTo", { max: filters.contractUntil }),
			],
			maxSalary: [
				t("market.column.salary"),
				t("market.chip.upTo", {
					max: props.formatSalary(filters.maxSalary ?? 0),
				}),
			],
		}[key];
		return t("market.chip", { label, value });
	};
	const active = activeFilterKeys(filters);

	return (
		<div className="flex flex-col gap-2 text-table">
			{/* biome-ignore lint/a11y/useSemanticElements: a fieldset would break the wrapping bar. */}
			<div
				role="group"
				aria-label={t("market.filters.label")}
				className="flex flex-wrap items-center gap-x-4 gap-y-2"
			>
				<fieldset
					aria-label={t("market.column.role")}
					className="m-0 flex shrink-0 gap-1 border-0 p-0"
				>
					{ROLES.map((role) => {
						const label = t(`market.role.${role}`);
						return (
							<RoleToggle
								key={role}
								role={role}
								label={label}
								pressed={filters.roles.includes(role)}
								onClick={() => toggleRole(role)}
							/>
						);
					})}
				</fieldset>
				<OptionSelect
					label={t("market.column.team")}
					anyLabel={t("market.filters.anyTeam")}
					options={props.teams}
					value={filters.team}
					onChange={(team) => set("team", team)}
				/>
				<RangeField
					label={t("market.filters.age")}
					minLabel={t("market.filters.ageMin")}
					maxLabel={t("market.filters.ageMax")}
					value={filters.age}
					onChange={(age) => set("age", age)}
				/>
				<RangeField
					label={t("market.filters.rating")}
					minLabel={t("market.filters.ratingMin")}
					maxLabel={t("market.filters.ratingMax")}
					value={filters.rating}
					onChange={(rating) => set("rating", rating)}
				/>
				<OptionSelect
					label={t("market.filters.contractUntil")}
					anyLabel={t("market.filters.anyContract")}
					options={props.years.map(String)}
					value={
						filters.contractUntil === null
							? null
							: String(filters.contractUntil)
					}
					onChange={(year) =>
						set("contractUntil", year === null ? null : Number(year))
					}
				/>
				<div className="flex items-center gap-2">
					<span aria-hidden className="text-muted">
						{t("market.filters.maxSalary")}
					</span>
					<NumberBox
						label={t("market.filters.maxSalary")}
						placeholder={t("market.filters.max")}
						value={filters.maxSalary ?? undefined}
						onChange={(value) => set("maxSalary", value ?? null)}
						step={500}
						className="w-24"
					/>
				</div>
			</div>
			{active.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					<ul
						aria-label={t("market.filters.active")}
						className="m-0 flex list-none flex-wrap gap-1.5 p-0"
					>
						{active.map((key) => {
							const text = chip(key);
							return (
								<li
									key={key}
									className="inline-flex items-center gap-1 rounded-control border border-line bg-surface ps-2 text-[13px]"
								>
									{text}
									<button
										type="button"
										aria-label={t("market.filters.remove", { filter: text })}
										onClick={() => onChange(clearFilter(filters, key))}
										className="press grid size-6 cursor-pointer place-items-center text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-action"
									>
										<X aria-hidden className="size-3.5" />
									</button>
								</li>
							);
						})}
					</ul>
					<Button
						variant="ghost"
						onClick={() => onChange(EMPTY_FILTERS)}
						className="h-7 text-[13px]"
					>
						{t("market.filters.clear")}
					</Button>
				</div>
			)}
		</div>
	);
}
