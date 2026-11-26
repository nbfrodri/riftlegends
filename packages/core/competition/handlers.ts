import type {
	CoreError,
	competitionCommands,
	competitionQueries,
} from "@rift-legends/contracts";
import type { LoadedContent } from "../draft/series";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import {
	createDispatcher,
	type Emitted,
	type Outcome,
} from "../server/dispatcher";
import { buildCalendar, type CalendarStage } from "./calendar";
import type { StageOutcome } from "./qualification";
import { buildStageGraph } from "./season";
import { seasonOverview } from "./season-overview";
import {
	gamesOf,
	type SeriesRecord,
	seriesMatch,
	seriesSummary,
} from "./season-records";
import { playSeasonSeries } from "./season-series";
import {
	isUnusedReservation,
	localFixtureId,
	type StageProgress,
} from "./season-stages";
import type { Played } from "./season-tables";
import { updateStages } from "./season-update";
import { projectSchedule, stageView } from "./season-views";
import { type StageGraph, type StageRef, stageKey } from "./stage-model";
import { teamProfile } from "./team-profile";

type Command<K> = Extract<
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
}

export interface SeasonSession {
	readonly loadContent: () => Iterable<SeasonContent>;
	readonly season?: RunningSeason;
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
	const { competitions: formats, teams, year, seed } = snapshot;
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
		},
		new Map(),
		facts,
	);
	return started.ok
		? { ok: true, state: { ...state, season: started.season }, facts }
		: started;
}

function playDay(
	state: SeasonSession,
	{ day }: Command<"season.playDay">,
): Outcome<SeasonSession> {
	const { season } = state;
	if (!season) return reject("wrong-action", { expected: "season.create" });
	const schedule = projectSchedule(season).filter(
		({ status }) => status !== "played",
	);
	const nextDay = schedule[0]?.day;
	if (nextDay !== day)
		return reject("wrong-action", { expected: nextDay ?? "season.create" });
	const fixtures = schedule.filter((slot) => slot.day === day);
	const playedDays = new Map(season.playedDays);
	const records = new Map(season.records);
	const today = new Map<string, Played[]>();
	const facts: Emitted[] = [];
	for (const slot of fixtures) {
		const { competition, stage } = slot;
		const key = stageKey(slot);
		const node = season.graph.nodes.get(key);
		const fixture = season.stages
			.get(key)
			?.fixtures.find(({ id }) => id === localFixtureId(slot.id));
		if (!node || !fixture)
			return reject("invalid-stage-ref", { competition, stage });
		// Series seeds are isolated from draws of priority and from the calendar day.
		const fixtureIndex = node.bracket
			? node.bracket.matches.findIndex(({ id }) => id === fixture.id)
			: Number(fixture.id.split("-").at(-1));
		const seriesSeed = deriveSeed(
			season.seed,
			SCOPES.competition,
			node.competitionIndex,
			season.year,
			node.stageIndex,
			0xfffffffb,
			fixture.round,
			fixtureIndex,
		);
		const played = playSeasonSeries(season.content, fixture, seriesSeed);
		if (!played.ok) return played;
		facts.push(...played.facts, {
			type: "competition.seriesRecorded",
			competition,
			stage,
			day,
			round: fixture.round,
			teams: fixture.teams,
			score: played.score,
			winner: played.winner,
			tiebreaker: fixture.tiebreaker ?? false,
		});
		records.set(slot.id, {
			id: slot.id,
			competition,
			stage,
			day,
			teams: fixture.teams,
			score: played.score,
			winner: played.winner,
			fixture,
			seed: seriesSeed,
			games: gamesOf(played.facts),
		});
		const results = today.get(key) ?? [];
		results.push({ fixture, winner: played.winner, result: played.result });
		today.set(key, results);
		playedDays.set(slot.id, day);
	}
	const updated = updateStages(
		{ ...season, playedDays, records },
		today,
		facts,
	);
	if (!updated.ok) return updated;
	let next = updated.season;
	const extraFixtures = new Map(
		[...next.stages]
			.filter(([, stage]) => stage.ties.length)
			.map(([key, stage]) => [key, stage.ties]),
	);
	if (
		[...extraFixtures].some(
			([key, ties]) => ties.length > (season.stages.get(key)?.ties.length ?? 0),
		)
	) {
		// Keep history fixed while making room for the newly discovered tiebreakers.
		const calendar = buildCalendar(season.graph, {
			year: season.year,
			seed: season.seed,
			outcomes: next.outcomes,
			extraFixtures,
			skipFixture: (ref, id) =>
				isUnusedReservation(next.stages.get(stageKey(ref)), id),
			playedDays,
			fromDay: day + 1,
		});
		if (!calendar.ok) return calendar;
		next = { ...next, calendar: calendar.stages };
	}
	return { ok: true, state: { ...state, season: next }, facts };
}

export const seasonDispatcher = createDispatcher<SeasonSession>({
	commands: { "season.create": createSeason, "season.playDay": playDay },
	queries: {
		"competition.standings": (state, ref: StageRef) =>
			stageView(state, ref, "standings"),
		"competition.bracket": (state, ref: StageRef) =>
			stageView(state, ref, "bracket"),
		"competition.schedule": (state, params: ScheduleQuery) =>
			state.season ? projectSchedule(state.season, params) : [],
		"season.overview": (state) => seasonOverview(state.season),
		"team.profile": teamProfile,
		"series.summary": seriesSummary,
		"match.view": seriesMatch,
		"competition.qualified": (
			state,
			{ competition }: { competition: string },
		) =>
			[...(state.season?.qualifications.values() ?? [])].filter(
				({ to }) => to === competition,
			),
	},
});
