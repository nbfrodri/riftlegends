import {
	CONTRACT_VERSION,
	type CoreError,
	type SeriesOptions,
	TOURNAMENT_PRESETS,
	type TournamentPresetView,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { SearchSelect } from "@rift-legends/ui-kit/components/search-select";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { appContent } from "../content-set";
import {
	CoreErrorMessage,
	CoreRequestError,
	useCoreCommand,
	useCoreQuery,
} from "../core";
import { teamGroups } from "../draft/setup-screen";
import {
	CUSTOM_TEAMS,
	type CustomForm,
	customStageIds,
	customStages,
	DEFAULT_CUSTOM,
	type Field,
	fieldOf,
	type Mode,
	type Preset,
	sameField,
} from "./tournament-form";
import { CustomEditor, Setting } from "./tournament-format";
import { TournamentReady } from "./tournament-ready";
import { CustomTeams, FieldError, PresetSlots } from "./tournament-teams";

const noFact = () => false;
const FEARLESS = ["hard", "soft", "off"] as const;
const MAX_SEED = 2 ** 32 - 1;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

/** The text of a core error at its field, in the user's words. */
function useErrorText() {
	const { t } = useTranslation();
	return (error: CoreError, field: Field, block?: string) => {
		if (error.code === "invalid-format") {
			if (field.kind === "team") return t("tournament.error.duplicate");
			if (field.kind === "teams") return t("tournament.error.teams");
			if (field.kind === "humanTeam") return t("tournament.error.humanTeam");
			if (field.kind === "stage")
				return String(error.params.path ?? "").endsWith("size") && block
					? t(`tournament.error.size.${block}`, {
							defaultValue: t("tournament.error.stage"),
						})
					: t("tournament.error.stage");
		}
		const { stage, competition } = error.params;
		return t(`errors.${error.code}`, {
			...error.params,
			...(typeof stage === "string" && {
				stage: t(`tournament.stage.${stage}`, { defaultValue: stage }),
			}),
			...(typeof competition === "string" && {
				competition: t(`tournament.preset.${competition}`, {
					defaultValue: competition,
				}),
			}),
		});
	};
}

/** U9: preset or custom, teams, my team or watch only, fearless and seed. */
export function TournamentSetup(props: {
	sessionId: number;
	onNew: () => void;
}) {
	const { t } = useTranslation();
	const { sessionId } = props;
	const content = appContent();
	const options = useCoreQuery<SeriesOptions>(
		{
			v: CONTRACT_VERSION,
			kind: "series.options",
			sessionId,
			params: { content },
		},
		{ affectedBy: noFact },
	);
	const ranked = useMemo(
		() => (options.data?.teams ?? []).slice().sort((a, b) => a.seed - b.seed),
		[options.data],
	);
	const leagues = ranked.some(({ league }) => league);
	const [chosen, setMode] = useState<Mode>("msi");
	const mode: Mode = leagues ? chosen : "custom";
	const preset = mode === "custom" ? null : mode;
	const slots = useCoreQuery<TournamentPresetView>(
		{
			v: CONTRACT_VERSION,
			kind: "tournament.preset",
			sessionId,
			params: { preset: preset ?? "msi" },
		},
		{ affectedBy: noFact, enabled: preset !== null },
	);
	const [edits, setEdits] = useState<Partial<Record<Preset, string[]>>>({});
	const [custom, setCustom] = useState<CustomForm>(DEFAULT_CUSTOM);
	const [customTeams, setCustomTeams] = useState<string[] | null>(null);
	const [human, setHuman] = useState("");
	const [fearless, setFearless] = useState<(typeof FEARLESS)[number]>("hard");
	const [seed, setSeed] = useState(randomSeed);
	const [created, setCreated] = useState<number | null>(null);
	const [rejected, setRejected] = useState<CoreRequestError | null>(null);
	const { mutateAsync, isPending } = useCoreCommand();
	const errorText = useErrorText();
	const humanId = useId();

	const bestTeams = ranked.slice(0, CUSTOM_TEAMS).map(({ id }) => id);
	const teams: readonly string[] =
		preset === null
			? (customTeams ?? bestTeams)
			: (edits[preset] ??
				(slots.data?.preset === preset
					? slots.data.slots.map(({ team }) => team)
					: []));
	const humanTeam = teams.includes(human) ? human : "";
	const year = options.data?.season ?? new Date().getFullYear();
	const payload =
		teams.length >= 2
			? {
					year,
					seed,
					fearless,
					teams,
					format:
						preset === null
							? { kind: "custom", stages: customStages(custom) }
							: { kind: "preset", preset },
					...(humanTeam && { humanTeam }),
				}
			: null;
	const check = useCoreQuery<{ error: CoreError | null }>(
		{
			v: CONTRACT_VERSION,
			kind: "tournament.check",
			sessionId,
			params: payload ?? {},
		},
		{ affectedBy: noFact, enabled: payload !== null && created === null },
	);
	const error = check.data?.error ?? null;
	const stageIds = preset === null ? customStageIds(custom) : [];
	const field = error && fieldOf(error, stageIds);
	const errorAt = (target: Field, block?: string) =>
		error && field && sameField(field, target)
			? errorText(error, field, block)
			: undefined;

	const nameOf = (id: string) =>
		ranked.find((team) => team.id === id)?.name ?? id;
	const groups = useMemo(
		() => teamGroups(ranked, (n) => t("draft.setup.seed", { n })),
		[ranked, t],
	);
	const humanGroups = [
		{ items: [{ value: "", label: t("tournament.watch") }] },
		{
			items: teams.map((id) => ({ value: id, label: nameOf(id) })),
		},
	];

	const setTeam = (index: number, id: string) => {
		const next = [...teams];
		next[index] = id;
		if (preset === null) setCustomTeams(next);
		else setEdits({ ...edits, [preset]: next });
	};
	const nextTeam = ranked.find(({ id }) => !teams.includes(id))?.id;

	async function start() {
		if (!payload) return;
		try {
			const result = await mutateAsync({
				v: CONTRACT_VERSION,
				kind: "tournament.create",
				sessionId,
				expectedPosition: 0,
				payload,
			});
			setCreated(result.position);
		} catch (caught) {
			if (!(caught instanceof CoreRequestError)) throw caught;
			setRejected(caught);
		}
	}

	if (!options.data) return null;
	if (created !== null)
		return (
			<TournamentReady
				name={t(preset ? `tournament.preset.${preset}` : "tournament.custom")}
				count={teams.length}
				team={humanTeam ? nameOf(humanTeam) : null}
				onNew={props.onNew}
			/>
		);

	const modes: Mode[] = [...TOURNAMENT_PRESETS, "custom"];
	const generalError =
		errorAt({ kind: "general" }) ?? errorAt({ kind: "teams" });
	return (
		<>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-gap">
				<section
					aria-label={t("tournament.rules")}
					className="min-h-0 min-w-0 scroll-edge bg-panel p-5 short:p-4"
				>
					<Setting
						title={t("tournament.format")}
						note={t(`tournament.formatNote.${preset ? "preset" : "custom"}`)}
					>
						<SegmentedControl
							label={t("tournament.format")}
							options={modes.map((value) => ({
								value,
								label: (
									<span className="whitespace-nowrap">
										{t(
											value === "custom"
												? "tournament.custom"
												: `tournament.preset.${value}`,
										)}
									</span>
								),
								disabled: value !== "custom" && !leagues,
							}))}
							value={mode}
							onChange={setMode}
						/>
					</Setting>
					{preset === null && (
						<CustomEditor
							form={custom}
							onChange={setCustom}
							errorAt={(index) =>
								errorAt(
									{ kind: "stage", index },
									index === 0 ? custom.block : custom.playoffs,
								)
							}
						/>
					)}
					<Setting
						title={t("draft.setup.fearless")}
						note={t(`draft.setup.fearlessNote.${fearless}`)}
					>
						<SegmentedControl
							label={t("draft.setup.fearless")}
							options={FEARLESS.map((value) => ({
								value,
								label: t(`draft.setup.fearless.${value}`),
							}))}
							value={fearless}
							onChange={setFearless}
						/>
					</Setting>
					<Setting title={t("tournament.seed")} note={t("tournament.seedNote")}>
						<div className="flex shrink-0 items-center gap-2">
							<input
								type="number"
								min={0}
								max={MAX_SEED}
								aria-label={t("tournament.seed")}
								value={seed}
								onChange={(event) => {
									const value = Number(event.target.value);
									if (
										Number.isInteger(value) &&
										value >= 0 &&
										value <= MAX_SEED
									)
										setSeed(value);
								}}
								className="w-[128px] rounded-control border border-line bg-surface px-2 py-[5px] text-text tabular-nums hover:border-muted"
							/>
							<Button
								variant="secondary"
								className="px-3 py-[5px]"
								onClick={() => setSeed(randomSeed())}
							>
								{t("tournament.newSeed")}
							</Button>
						</div>
					</Setting>
				</section>
				<section className="flex min-h-0 min-w-0 flex-col bg-panel p-5 short:p-4">
					<div className="flex items-baseline justify-between gap-3">
						<h2 className="font-bold font-display text-xl tracking-heading">
							{t("tournament.teams")}
						</h2>
						<span className="text-muted">
							{t("tournament.teamCount", { count: teams.length })}
						</span>
					</div>
					<div className="mt-2 flex items-center gap-3">
						<span className="w-[118px] shrink-0 font-semibold">
							{t("tournament.myTeam")}
						</span>
						<SearchSelect
							label={t("tournament.myTeam")}
							searchLabel={t("draft.setup.searchTeam")}
							empty={t("draft.setup.noTeam")}
							groups={humanGroups}
							value={humanTeam}
							onChange={setHuman}
							className="w-0 min-w-0 flex-1"
							describedBy={humanId}
						/>
					</div>
					<p
						id={humanId}
						className="mt-1 border-line border-b pr-4 pb-[clamp(6px,1vh,10px)] text-[13px] text-muted"
					>
						{errorAt({ kind: "humanTeam" }) ?? t("tournament.myTeamNote")}
					</p>
					<div className="mt-1 min-h-0 flex-1 scroll-edge-[20px] short:scroll-edge-[16px]">
						{preset === null ? (
							<CustomTeams
								teams={teams}
								groups={groups}
								onChange={setTeam}
								onRemove={(index) =>
									setCustomTeams(teams.filter((_, i) => i !== index))
								}
								onAdd={() => nextTeam && setCustomTeams([...teams, nextTeam])}
								canAdd={nextTeam !== undefined && teams.length < 32}
								errorAt={(index) => errorAt({ kind: "team", index })}
							/>
						) : (
							<PresetSlots
								slots={slots.data?.preset === preset ? slots.data.slots : []}
								teams={teams}
								groups={groups}
								onChange={setTeam}
								errorAt={(index) => errorAt({ kind: "team", index })}
							/>
						)}
					</div>
				</section>
			</div>
			<footer className="flex items-center justify-between gap-4 border-line border-t pt-[clamp(8px,1.4vh,14px)]">
				<div className="min-w-0 text-muted" aria-live="polite">
					{generalError && <FieldError id="" text={generalError} />}
					{rejected && <CoreErrorMessage error={rejected} />}
				</div>
				<Button
					disabled={!payload || !check.data || error !== null || isPending}
					onClick={() => void start()}
				>
					{t("tournament.start")}
				</Button>
			</footer>
		</>
	);
}
