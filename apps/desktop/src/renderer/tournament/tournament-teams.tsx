import type { TournamentPresetView } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import {
	SearchSelect,
	type SearchSelectGroup,
} from "@rift-legends/ui-kit/components/search-select";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";

type Slot = TournamentPresetView["slots"][number];

/** An error under a field, linked to it with `aria-describedby`. */
export function FieldError(props: { id: string; text: string | undefined }) {
	if (!props.text) return null;
	return (
		<p id={props.id} className="mt-1 text-[13px] text-bad">
			{props.text}
		</p>
	);
}

function TeamRow(props: {
	label: string;
	lead: React.ReactNode;
	value: string;
	groups: readonly SearchSelectGroup[];
	onChange: (id: string) => void;
	error: string | undefined;
	children?: React.ReactNode;
}) {
	const { t } = useTranslation();
	const errorId = useId();
	return (
		<li className="border-line border-t py-[clamp(5px,0.8vh,9px)] first:border-t-0">
			<div className="flex items-center gap-3">
				<span className="flex w-[118px] shrink-0 items-center gap-2 text-muted">
					{props.lead}
				</span>
				<SearchSelect
					label={props.label}
					searchLabel={t("draft.setup.searchTeam")}
					empty={t("draft.setup.noTeam")}
					groups={props.groups}
					value={props.value}
					onChange={props.onChange}
					className="w-0 min-w-0 flex-1"
					describedBy={props.error ? errorId : undefined}
				/>
				{props.children}
			</div>
			<FieldError id={errorId} text={props.error} />
		</li>
	);
}

/** The slots of a preset: each league place with the team that fills it. */
export function PresetSlots(props: {
	slots: readonly Slot[];
	teams: readonly string[];
	groups: readonly SearchSelectGroup[];
	onChange: (index: number, id: string) => void;
	errorAt: (index: number) => string | undefined;
}) {
	const { t } = useTranslation();
	const stages = [...new Set(props.slots.map(({ stage }) => stage))];
	return stages.map((stage) => (
		<section
			key={stage}
			aria-label={t(`tournament.stage.${stage}`, { defaultValue: stage })}
		>
			<h3 className="mt-2 mb-1 font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
				{t(`tournament.stage.${stage}`, { defaultValue: stage })}
			</h3>
			<ol>
				{props.slots.map((slot, index) =>
					slot.stage === stage ? (
						<TeamRow
							key={`${slot.league}-${slot.place}`}
							label={t("tournament.slot", slot)}
							lead={
								<>
									<span aria-hidden="true">
										<LeagueLogo id={slot.league} name={slot.league} />
									</span>
									{t("tournament.slotShort", slot)}
								</>
							}
							value={props.teams[index] ?? slot.team}
							groups={props.groups}
							onChange={(id) => props.onChange(index, id)}
							error={props.errorAt(index)}
						/>
					) : null,
				)}
			</ol>
		</section>
	));
}

/** The teams of a custom tournament, in seed order, with add and remove. */
export function CustomTeams(props: {
	teams: readonly string[];
	groups: readonly SearchSelectGroup[];
	onChange: (index: number, id: string) => void;
	onRemove: (index: number) => void;
	onAdd: () => void;
	canAdd: boolean;
	errorAt: (index: number) => string | undefined;
}) {
	const { t } = useTranslation();
	return (
		<>
			<ol>
				{props.teams.map((team, index) => (
					<TeamRow
						key={team}
						label={t("tournament.team", { n: index + 1 })}
						lead={t("tournament.seedRank", { n: index + 1 })}
						value={team}
						groups={props.groups.map((group) => ({
							...group,
							// Teams already in the list are not offered again.
							items: group.items.filter(
								({ value }) => value === team || !props.teams.includes(value),
							),
						}))}
						onChange={(id) => props.onChange(index, id)}
						error={props.errorAt(index)}
					>
						<Button
							variant="ghost"
							className="px-2 py-[5px] text-muted"
							aria-label={t("tournament.removeTeam", { n: index + 1 })}
							disabled={props.teams.length <= 2}
							onClick={() => props.onRemove(index)}
						>
							{t("tournament.remove")}
						</Button>
					</TeamRow>
				))}
			</ol>
			<Button
				variant="secondary"
				className="mt-2 px-3 py-[5px]"
				disabled={!props.canAdd}
				onClick={props.onAdd}
			>
				{t("tournament.addTeam")}
			</Button>
		</>
	);
}
