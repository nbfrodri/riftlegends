import { TOURNAMENT_STAGE_TYPES } from "@rift-legends/contracts";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import {
	type BestOf,
	type Block,
	type CustomForm,
	isKnockout,
	type Playoffs,
} from "./tournament-form";
import { FieldError } from "./tournament-teams";

const BEST_OF = ["1", "3", "5"] as const;
const GROUPS = ["2", "4"] as const;
const PLAYOFFS = ["none", "singleElim", "doubleElim"] as const;
const PLAYOFF_SIZES = ["2", "4", "8", "16"] as const;

/** A labelled setting in one line: name and note on the left, control on the right. */
export function Setting(props: {
	title: string;
	note?: string | undefined;
	children: ReactNode;
}) {
	return (
		<div className="border-line border-t py-[clamp(6px,1vh,12px)] first:border-t-0 first:pt-0">
			<div className="flex items-center justify-between gap-4">
				<h3 className="font-semibold">{props.title}</h3>
				{props.children}
			</div>
			{props.note && (
				<p className="mt-1 text-[13px] text-muted">{props.note}</p>
			)}
		</div>
	);
}

function BestOfControl(props: {
	value: BestOf;
	onChange: (value: BestOf) => void;
}) {
	const { t } = useTranslation();
	return (
		<SegmentedControl
			label={t("tournament.bestOf")}
			options={BEST_OF.map((value) => ({
				value,
				label: t(`draft.setup.format.bo${value}`),
			}))}
			value={String(props.value) as (typeof BEST_OF)[number]}
			onChange={(value) => props.onChange(Number(value) as BestOf)}
		/>
	);
}

/** One stage of the editor: a fieldset named after it, with its error under it. */
function StageFieldset(props: {
	legend: string;
	error: string | undefined;
	children: ReactNode;
}) {
	const errorId = useId();
	return (
		<fieldset
			aria-describedby={props.error ? errorId : undefined}
			className="m-0 min-w-0 border-0 border-line border-t p-0 py-[clamp(6px,1vh,12px)]"
		>
			<legend className="float-left mb-1 w-full font-semibold">
				{props.legend}
			</legend>
			<div className="clear-left flex flex-wrap items-center gap-x-4 gap-y-2">
				{props.children}
			</div>
			<FieldError id={errorId} text={props.error} />
		</fieldset>
	);
}

/** The simple editor (plan 31, decision 3): a first stage and an optional knockout. */
export function CustomEditor(props: {
	form: CustomForm;
	onChange: (form: CustomForm) => void;
	errorAt: (stage: number) => string | undefined;
}) {
	const { t } = useTranslation();
	const { form, onChange } = props;
	const set = (patch: Partial<CustomForm>) => onChange({ ...form, ...patch });
	const blocks = TOURNAMENT_STAGE_TYPES.map((value) => ({
		value,
		label: t(`tournament.block.${value}`),
	}));
	const knockoutFirst = isKnockout(form.block);
	return (
		<>
			<StageFieldset legend={t("tournament.stage1")} error={props.errorAt(0)}>
				<Select
					items={blocks}
					value={form.block}
					onValueChange={(value) => value && set({ block: value as Block })}
				>
					<SelectTrigger
						aria-label={t("tournament.block")}
						className="min-w-[190px]"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{blocks.map(({ value, label }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<BestOfControl
					value={form.bestOf}
					onChange={(bestOf) => set({ bestOf })}
				/>
				{form.block === "groups" && (
					<SegmentedControl
						label={t("tournament.groupCount")}
						options={GROUPS.map((value) => ({
							value,
							label: t("tournament.groupsN", { count: Number(value) }),
						}))}
						value={String(form.groups) as (typeof GROUPS)[number]}
						onChange={(value) => set({ groups: Number(value) })}
					/>
				)}
			</StageFieldset>
			<StageFieldset legend={t("tournament.stage2")} error={props.errorAt(1)}>
				<SegmentedControl
					label={t("tournament.knockout")}
					options={PLAYOFFS.map((value) => ({
						value,
						label: t(`tournament.knockout.${value}`),
						disabled: knockoutFirst && value !== "none",
					}))}
					value={knockoutFirst ? "none" : form.playoffs}
					onChange={(playoffs: Playoffs) => set({ playoffs })}
				/>
				{!knockoutFirst && form.playoffs !== "none" && (
					<>
						<SegmentedControl
							label={t("tournament.knockoutSize")}
							options={PLAYOFF_SIZES.map((value) => ({ value, label: value }))}
							value={String(form.playoffSize) as (typeof PLAYOFF_SIZES)[number]}
							onChange={(value) => set({ playoffSize: Number(value) })}
						/>
						<BestOfControl
							value={form.playoffBestOf}
							onChange={(playoffBestOf) => set({ playoffBestOf })}
						/>
					</>
				)}
			</StageFieldset>
		</>
	);
}
