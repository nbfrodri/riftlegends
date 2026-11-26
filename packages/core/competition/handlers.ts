import type {
	CoreError,
	competitionCommands,
	competitionQueries,
} from "@rift-legends/contracts";
import type { LoadedContent, SeriesState } from "../draft/series";
import {
	createDispatcher,
	type Emitted,
	type Outcome,
	QueryRejection,
} from "../server/dispatcher";
import { buildCalendar, type CalendarStage } from "./calendar";
import { exhibitionSeason } from "./exhibition";
import type { StageOutcome } from "./qualification";
import { buildStageGraph } from "./season";
import { playDay } from "./season-day";
import {
	humanMatch,
	humanSeriesCommands,
	humanSeriesQueries,
	humanSummary,
	playSeries,
} from "./season-human";
import { seasonOverview } from "./season-overview";
import type { DayLog, Slot, SlotSeries } from "./season-play";
import {
	type SeriesRecord,
	seriesMatch,
	seriesSummary,
} from "./season-records";
import type { StageProgress } from "./season-stages";
import { updateStages } from "./season-update";
import { projectSchedule, stageView } from "./season-views";
import type { StageGraph, StageRef } from "./stage-model";
import { teamProfile } from "./team-profile";
import { presetSlots, tournamentSeason } from "./tournament";

export type Command<K> = Extract<
	ReturnType<typeof competitionCommands.schema.parse>,
	{ kind: K }
>["payload"];
export type ScheduleQuery = Extract<
	ReturnType<typeof competitionQueries.schema.parse>,
	{ kind: "competition.schedule" }
>["params"];

interface SeasonContent extends LoadedContent {
	readonly version: number;
}

export interface RunningSeason {
	readonly year: number;
	readonly seed: number;
	readonly graph: StageGraph;
	readonly content: SeasonContent;
	readonly calendar: readonly CalendarStage[];
	readonly stages: ReadonlyMap<string, StageProgress>;
	readonly outcomes: ReadonlyMap<string, StageOutcome>;
	readonly qualifications: ReadonlyMap<string, Emitted>;
	readonly playedDays: ReadonlyMap<string, number>;
	/** Every series played, by the id of its slot. */
	readonly records: ReadonlyMap<string, SeriesRecord>;
	readonly formats: Command<"season.create">["competitions"];
	/** The team the user manages, if any. */
	readonly humanTeam?: string | undefined;
	/** Schedule id of the user's series that waits to be played. */
	readonly pending?: string | undefined;
}

export interface SeasonSession {
	readonly loadContent: () => Iterable<SeasonContent>;
	readonly season?: RunningSeason;
	/** The user's series in play, with the draft state it runs on. */
	readonly human?: HumanSeries;
	/** A day played in batches that has not closed yet. */
	readonly dayLog?: { readonly day: number; readonly log: DayLog };
}

interface HumanSeries {
	readonly slot: Slot;
	readonly series: SlotSeries;
	readonly state: SeriesState;
	/** Every fact of the series so far, to record it like the AI's. */
	readonly facts: readonly Emitted[];
}

export const seasonStateWith = (
	loadContent: SeasonSession["loadContent"],
): SeasonSession => ({ loadContent });

const reject = (code: CoreError["code"], params: CoreError["params"] = {}) => ({
	ok: false as const,
	error: { code, params },
});

function createSeason(
	state: SeasonSession,
	payload: Command<"season.create">,
): Outcome<SeasonSession> {
	const running = state.season;
	if (
		running &&
		(payload.year <= running.year ||
			running.outcomes.size !== running.graph.nodes.size)
	)
		return reject("format-locked");
	const snapshot: typeof payload = structuredClone(payload);
	const { competitions: formats, teams, year, seed, humanTeam } = snapshot;
	if (humanTeam !== undefined && !teams.some(({ id }) => id === humanTeam))
		return reject("invalid-format", { path: "humanTeam" });
	const built = buildStageGraph(formats, teams);
	if (!built.ok) return built;
	// Qualification by points needs scoring rules, which the format cannot declare.
	const pointsFormat = formats.findIndex((format) =>
		format.slots?.some(({ rule }) => rule === "points"),
	);
	if (pointsFormat >= 0)
		return reject("invalid-format", {
			path: `competitions.${pointsFormat}.slots`,
		});
	const { graph } = built;
	const calendar = buildCalendar(graph, { year, seed });
	if (!calendar.ok) return calendar;
	let content: SeasonContent | undefined;
	for (const set of state.loadContent()) {
		const ids = new Set(set.match.teams.map(({ id }) => id));
		if (!teams.every(({ id }) => ids.has(id))) continue;
		content = set;
		break;
	}
	if (!content) return reject("invalid-format", { path: "teams" });
	const facts: Emitted[] = [
		{
			type: "season.created",
			...snapshot,
			contentVersion: String(content.version),
		},
	];
	const started = updateStages(
		{
			year,
			seed,
			graph,
			content,
			formats: structuredClone(formats),
			calendar: calendar.stages,
			stages: new Map(),
			outcomes: new Map(),
			qualifications: new Map(),
			playedDays: new Map(),
			records: new Map(),
			humanTeam,
		},
		new Map(),
		facts,
	);
	return started.ok
		? { ok: true, state: { ...state, season: started.season }, facts }
		: started;
}

/** A tournament replaces a finished season only; a running one is locked. */
function createTournament(
	state: SeasonSession,
	payload: Command<"tournament.create">,
): Outcome<SeasonSession> {
	const { season, loadContent } = state;
	if (season && season.outcomes.size !== season.graph.nodes.size)
		return reject("format-locked");
	const built = tournamentSeason(payload, loadContent);
	// A new session state: nothing of the finished season carries over.
	return built.ok ? createSeason({ loadContent }, built.season) : built;
}

export const seasonDispatcher = createDispatcher<SeasonSession>({
	commands: {
		"season.create": createSeason,
		"season.playDay": playDay,
		"season.playSeries": playSeries,
		"tournament.create": createTournament,
		...humanSeriesCommands,
	},
	queries: {
		"competition.standings": (state, ref: StageRef) =>
			stageView(state, ref, "standings"),
		"competition.bracket": (state, ref: StageRef) =>
			stageView(state, ref, "bracket"),
		"competition.schedule": (state, params: ScheduleQuery) =>
			state.season ? projectSchedule(state.season, params) : [],
		"season.overview": (state) => seasonOverview(state.season),
		"season.exhibition": (
			_state,
			params: Parameters<typeof exhibitionSeason>[0],
		) => exhibitionSeason(params),
		...humanSeriesQueries,
		"team.profile": teamProfile,
		"tournament.preset": (state, { preset }) => {
			const slots = presetSlots(preset, state.loadContent);
			return slots.ok ? slots.view : new QueryRejection(slots.error);
		},
		"tournament.check": ({ loadContent }, payload) => {
			const outcome = createTournament({ loadContent }, payload);
			return { error: outcome.ok ? null : outcome.error };
		},
		"series.summary": (state, params) =>
			params.series ? seriesSummary(state, params) : humanSummary(state),
		"match.view": (state, params) =>
			params.series ? seriesMatch(state, params) : humanMatch(state, params),
		"competition.qualified": (
			state,
			{ competition }: { competition: string },
		) =>
			[...(state.season?.qualifications.values() ?? [])].filter(
				({ to }) => to === competition,
			),
	},
});
