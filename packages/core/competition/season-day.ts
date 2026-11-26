import type { CoreError } from "@rift-legends/contracts";
import type { Emitted, Outcome } from "../server/dispatcher";
import type { Command, SeasonSession } from "./handlers";
import {
	closeDay,
	openDayLog,
	recordSeries,
	type Slot,
	slotSeries,
} from "./season-play";
import { playSeasonSeries } from "./season-series";
import { projectSchedule } from "./season-views";

const reject = (code: CoreError["code"], params: CoreError["params"] = {}) => ({
	ok: false as const,
	error: { code, params },
});

/**
 * Plays the series of a day, at most `maxSeries` of them per command. The
 * partial log waits in the session; the day closes with its last series, and
 * the facts of all the batches together are those of the whole day.
 */
export function playDay(
	state: SeasonSession,
	{ day, maxSeries }: Command<"season.playDay">,
): Outcome<SeasonSession> {
	const { season } = state;
	if (!season) return reject("wrong-action", { expected: "season.create" });
	const schedule = projectSchedule(season).filter(
		({ status }) => status !== "played",
	);
	const nextDay = schedule[0]?.day;
	if (nextDay !== day)
		return reject("wrong-action", { expected: nextDay ?? "season.create" });
	const log = state.dayLog?.day === day ? state.dayLog.log : openDayLog(season);
	const before = log.facts.length;
	let waiting: Slot | undefined;
	let playing = 0;
	const todo = schedule.filter((slot) => slot.day === day);
	for (const [index, slot] of todo.entries()) {
		if (log.records.has(slot.id)) continue;
		const { competition, stage } = slot;
		const series = slotSeries(season, slot);
		if (!series) return reject("invalid-stage-ref", { competition, stage });
		if (season.humanTeam && series.fixture.teams.includes(season.humanTeam)) {
			waiting = slot;
			continue;
		}
		if (maxSeries !== undefined && playing >= maxSeries) {
			const rest = todo.slice(index);
			if (rest.some((s) => !log.records.has(s.id) && s.id !== waiting?.id))
				return partial(state, day, log, before);
		}
		const played = playSeasonSeries(
			season.content,
			series.fixture,
			series.seed,
			series.fearless,
		);
		if (!played.ok) return played;
		recordSeries(log, slot, series, played);
		playing++;
	}
	if (waiting?.id === season.pending && !log.facts.length)
		return reject("wrong-action", { expected: "season.playSeries" });
	const fixture = waiting && slotSeries(season, waiting)?.fixture;
	if (waiting && fixture)
		log.facts.push({
			type: "competition.seriesPending",
			competition: waiting.competition,
			stage: waiting.stage,
			day,
			round: fixture.round,
			series: waiting.id,
			teams: fixture.teams,
		});
	const closed = closeDay(season, log, day);
	if (!closed.ok) return closed;
	const { dayLog: _done, ...rest } = state;
	return {
		ok: true,
		state: { ...rest, season: { ...closed.season, pending: waiting?.id } },
		facts: log.facts.slice(before),
	};
}

const partial = (
	state: SeasonSession,
	day: number,
	log: ReturnType<typeof openDayLog>,
	before: number,
): Outcome<SeasonSession> => ({
	ok: true,
	state: { ...state, dayLog: { day, log } },
	facts: log.facts.slice(before) as Emitted[],
});
