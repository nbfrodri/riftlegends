import type { CoreError } from "@rift-legends/contracts";
import { max, min } from "../math/int";
import { allocate, type CalendarSeries, type Job } from "./calendar-allocation";
import { type FixtureSlot, stageFixtures } from "./calendar-fixtures";
import {
	DAILY_CAPACITY,
	DAYS_PER_WEEK,
	type StageWindow,
	stageWindows,
} from "./calendar-windows";
import type { StageOutcomes } from "./qualification";
import { type StageGraph, type StageRef, stageError } from "./stage-model";

interface CalendarStage {
	readonly ref: StageRef;
	readonly startDay: number;
	readonly endDay: number;
	readonly series: readonly CalendarSeries[];
}

interface CalendarOptions {
	readonly year: number;
	readonly seed: number;
	readonly outcomes?: StageOutcomes;
}

type CalendarResult =
	| { ok: true; stages: readonly CalendarStage[] }
	| { ok: false; error: CoreError };

const ceilDiv = (number: number, divisor: number) =>
	(number + ((divisor - (number % divisor)) % divisor)) / divisor;

function availableDays(stage: StageWindow): number {
	let available = 0;
	for (let day = stage.startDay; day < stage.endDay; day += DAYS_PER_WEEK) {
		available += min(stage.matchDays, stage.endDay - day);
	}
	return available;
}

function tooLong(
	stage: StageWindow,
	minimum: number,
): { ok: false; error: CoreError } {
	const available = availableDays(stage);
	return {
		ok: false,
		error: stageError(stage.node, "format-too-long", {
			needed: max(available + 1, minimum),
			available,
		}),
	};
}

function minimumDays(stage: StageWindow, fixtures: readonly FixtureSlot[]) {
	const appearances = new Map<string, number>();
	let days = ceilDiv(fixtures.length, stage.maxSeriesPerDay);
	for (const { entrants } of fixtures) {
		for (const team of entrants) {
			const count = (appearances.get(team) ?? 0) + 1;
			appearances.set(team, count);
			days = max(days, count);
		}
	}
	const depth = new Map<string, number>();
	for (const { id, after } of fixtures) {
		const length =
			1 +
			after.reduce(
				(longest, before) => max(longest, depth.get(before) ?? 0),
				0,
			);
		depth.set(id, length);
		days = max(days, length);
	}
	return days;
}

/** Plan the season within its fixed Gregorian year. Pending series use slots
 * until the stage resolver supplies teams. No clock or random draws are needed
 * for day placement; the seed is only used to resolve the existing stage draw. */
export function buildCalendar(
	graph: StageGraph,
	{ year, seed, outcomes = new Map() }: CalendarOptions,
): CalendarResult {
	if (!Number.isSafeInteger(year) || year < 1970 || year > 9999)
		return {
			ok: false,
			error: { code: "invalid-format", params: { path: "year" } },
		};
	const planned = stageWindows(graph, year, outcomes);
	if (!planned.windows) {
		return {
			ok: false,
			error: { code: "invalid-stage-ref", params: { ...planned.cycle?.ref } },
		};
	}

	const jobs: Job[] = [];
	const stageJobs = new Map<string, number[]>();
	for (const [key, stage] of planned.windows) {
		const result = stageFixtures(graph, stage.node, outcomes, seed, year);
		if (result.error) return { ok: false, error: result.error };
		const minimum = minimumDays(stage, result.fixtures);
		if (minimum > availableDays(stage)) return tooLong(stage, minimum);

		const previousStages = [...stage.after].flatMap(
			(id) => stageJobs.get(id) ?? [],
		);
		const local = new Map<string, number>();
		const indexes: number[] = [];
		for (const fixture of result.fixtures) {
			const after = fixture.after.map((id) => local.get(id) as number);
			const [home, away] = fixture.teams;
			const teams =
				home !== null && away !== null
					? new Set([home, away])
					: stage.possibleTeams;
			local.set(fixture.id, jobs.length);
			indexes.push(jobs.length);
			jobs.push({
				stage,
				fixture,
				after: [...previousStages, ...after],
				teams,
			});
		}
		stageJobs.set(key, indexes);
	}

	// Interval demand per competition is a cheap necessary check before searching.
	for (const competition of new Set(
		jobs.map(({ stage }) => stage.node.ref.competition),
	)) {
		const own = jobs.filter(
			({ stage }) => stage.node.ref.competition === competition,
		);
		for (const start of new Set(own.map(({ stage }) => stage.startDay))) {
			const relevant = own.filter(({ stage }) => stage.startDay >= start);
			for (const end of new Set(relevant.map(({ stage }) => stage.endDay))) {
				const due = relevant.filter(({ stage }) => stage.endDay <= end);
				if (due.length > (end - start) * DAILY_CAPACITY) {
					const last = due.at(-1) as Job;
					return tooLong(last.stage, 0);
				}
			}
		}
	}

	const result = allocate(
		jobs,
		planned.seasonDays,
		planned.absences,
		graph.leagues,
	);
	if (!Array.isArray(result)) return tooLong(result.stage, 0);
	const stages: CalendarStage[] = [];
	for (const [key, { ref }] of graph.nodes) {
		const stage = planned.windows.get(key) as StageWindow;
		stages.push({
			ref,
			startDay: stage.startDay,
			endDay: stage.endDay,
			series: (stageJobs.get(key) ?? [])
				.map((index) => result[index] as CalendarSeries)
				.sort((a, b) => a.day - b.day),
		});
	}
	return { ok: true, stages };
}
