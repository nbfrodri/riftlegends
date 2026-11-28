import type { SeriesState } from "../draft/series";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import type { Emitted } from "../server/dispatcher";
import { buildCalendar } from "./calendar";
import type { RunningSeason } from "./handlers";
import { gamesOf, type SeriesRecord } from "./season-records";
import type { Fearless, SeasonFixture } from "./season-series";
import {
	isUnusedReservation,
	localFixtureId,
	type StageProgress,
} from "./season-stages";
import type { Played } from "./season-tables";
import { updateStages } from "./season-update";
import type { projectSchedule } from "./season-views";
import { stageKey } from "./stage-model";

export type Slot = ReturnType<typeof projectSchedule>[number];

/** What a slot of the calendar plays: its fixture and the seed of its series. */
export interface SlotSeries {
	readonly key: string;
	readonly fixture: StageProgress["fixtures"][number];
	readonly seed: number;
	readonly fearless: Fearless;
}

export function slotSeries(
	season: RunningSeason,
	slot: Slot,
): SlotSeries | undefined {
	const key = stageKey(slot);
	const node = season.graph.nodes.get(key);
	const fixture = season.stages
		.get(key)
		?.fixtures.find(({ id }) => id === localFixtureId(slot.id));
	if (!node || !fixture) return undefined;
	// Series seeds are isolated from draws of priority and from the calendar day.
	const fixtureIndex = node.bracket
		? node.bracket.matches.findIndex(({ id }) => id === fixture.id)
		: Number(fixture.id.split("-").at(-1));
	const seed = deriveSeed(
		season.seed,
		SCOPES.competition,
		node.competitionIndex,
		season.year,
		node.stageIndex,
		0xfffffffb,
		fixture.round,
		fixtureIndex,
	);
	const fearless = season.formats[node.competitionIndex]?.fearless ?? "hard";
	return { key, fixture, seed, fearless };
}

/** The series a day has already played, and the facts and results it gave. */
export interface DayLog {
	readonly playedDays: Map<string, number>;
	readonly records: Map<string, SeriesRecord>;
	readonly today: Map<string, Played[]>;
	readonly facts: Emitted[];
}

export const openDayLog = (season: RunningSeason): DayLog => ({
	playedDays: new Map(season.playedDays),
	records: new Map(season.records),
	today: new Map(),
	facts: [],
});

interface PlayedSeries {
	readonly facts: readonly Emitted[];
	readonly score: readonly [number, number];
	readonly winner: string;
	readonly result: Played["result"];
	/** The final state of the user's series; AI series are replayed instead. */
	readonly human?: SeriesState;
}

/** Writes a finished series in the log: the same facts whoever played it. */
export function recordSeries(
	log: DayLog,
	slot: Slot,
	{ key, fixture, seed, fearless }: SlotSeries,
	played: PlayedSeries,
) {
	const { competition, stage, day } = slot;
	log.facts.push(...played.facts, {
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
	log.records.set(slot.id, {
		id: slot.id,
		competition,
		stage,
		day,
		teams: fixture.teams,
		score: played.score as SeriesRecord["score"],
		winner: played.winner,
		fixture: fixture as SeasonFixture,
		seed,
		fearless,
		games: gamesOf(played.facts),
		...(played.human ? { human: played.human } : {}),
	});
	const results = log.today.get(key) ?? [];
	results.push({ fixture, winner: played.winner, result: played.result });
	log.today.set(key, results);
	log.playedDays.set(slot.id, day);
}

/** Advances the stages with what the log holds and makes room for new tiebreakers. */
export function closeDay(season: RunningSeason, log: DayLog, day: number) {
	const { playedDays, records, today, facts } = log;
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
	return { ok: true as const, season: next };
}
