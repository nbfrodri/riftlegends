import { max, min } from "../math/int";
import type { FixtureSlot } from "./calendar-fixtures";
import {
	DAILY_CAPACITY,
	DAYS_PER_WEEK,
	type StageWindow,
	type Window,
} from "./calendar-windows";

type Delay =
	| "international-window"
	| "team-busy"
	| "day-full"
	| "weekly-limit"
	| "preserve-capacity";
export interface CalendarSeries {
	readonly id: string;
	readonly teams: FixtureSlot["teams"];
	readonly day: number;
	readonly explanation: {
		readonly rule: "first-available";
		readonly earliestDay: number;
		readonly skipped: readonly { day: number; reason: Delay }[];
	};
}

export interface Job {
	readonly stage: StageWindow;
	readonly fixture: FixtureSlot;
	readonly after: readonly number[];
	readonly teams: ReadonlySet<string>;
}

const weekOf = (day: number) => (day - (day % DAYS_PER_WEEK)) / DAYS_PER_WEEK;
function conflict(a: Job, b: Job): boolean {
	if (a.stage === b.stage) {
		// Unresolved bracket paths and Swiss rounds are ordered by their feeders.
		return a.fixture.entrants.some((team) => b.fixture.entrants.includes(team));
	}
	if (
		a.stage.node.ref.competition === b.stage.node.ref.competition &&
		a.stage.separateQualifiers &&
		b.stage.separateQualifiers
	)
		return false; // Qualification places are exclusive within an event.
	return [...a.teams].some((team) => b.teams.has(team));
}

const during = ({ startDay, endDay }: Window, day: number) =>
	startDay <= day && day < endDay;

export function allocate(
	jobs: readonly Job[],
	seasonDays: number,
	absences: ReadonlyMap<string, readonly Window[]>,
	leagues: ReadonlySet<string>,
): CalendarSeries[] | Job {
	const placed: CalendarSeries[] = [];
	const byDay: Job[][] = Array.from({ length: seasonDays }, () => []);
	const stageWeeks = new Map<StageWindow, number[]>();
	for (const { stage } of jobs) stageWeeks.set(stage, []);
	const blackouts = jobs.map((job) =>
		leagues.has(job.stage.node.ref.competition)
			? [...job.teams].flatMap((team) => absences.get(team) ?? [])
			: [],
	);
	const blocked = (index: number, day: number) =>
		blackouts[index]?.some((window) => during(window, day)) ?? false;
	const latest = jobs.map(({ stage }) => stage.endDay - 1);
	// Work backwards so tight successor windows constrain their feeders too.
	for (let index = jobs.length - 1; index >= 0; index--) {
		const job = jobs[index] as Job;
		let day = latest[index] as number;
		while (day >= job.stage.startDay && blocked(index, day)) day--;
		if (day < job.stage.startDay) return job;
		latest[index] = day;
		for (const before of job.after)
			latest[before] = min(latest[before] as number, day - 1);
	}

	function reason(
		job: Job,
		today: readonly Job[],
		week: number,
	): Delay | undefined {
		if (today.some((other) => conflict(job, other))) return "team-busy";
		const stageCount = today.filter(({ stage }) => stage === job.stage).length;
		const competition = job.stage.node.ref.competition;
		const competitionCount = today.filter(
			({ stage }) => stage.node.ref.competition === competition,
		).length;
		if (
			competitionCount >= DAILY_CAPACITY ||
			stageCount >= job.stage.maxSeriesPerDay
		)
			return "day-full";
		if (stageCount === 0 && week >= job.stage.matchDays) return "weekly-limit";
	}

	let furthest = 0;
	function place(index: number): boolean {
		const job = jobs[index];
		if (!job) return true;
		furthest = max(furthest, index);
		const { stage, fixture, after } = job;
		const earliestDay = after.reduce(
			(day, prior) => max(day, (placed[prior]?.day as number) + 1),
			stage.startDay,
		);
		const skipped = new Map<Delay, number>();
		const weeks = stageWeeks.get(stage) as number[];
		for (let day = earliestDay; day <= (latest[index] as number); day++) {
			const today = byDay[day] as Job[];
			const week = weekOf(day);
			const used = weeks[week] ?? 0;
			const delay = blocked(index, day)
				? "international-window"
				: reason(job, today, used);
			if (delay) {
				if (!skipped.has(delay)) skipped.set(delay, day);
				continue;
			}

			if (!today.some((other) => other.stage === stage)) weeks[week] = used + 1;
			today.push(job);
			placed.push({
				id: JSON.stringify([
					stage.node.ref.competition,
					stage.node.ref.stage,
					fixture.id,
				]),
				teams: fixture.teams,
				day,
				explanation: {
					rule: "first-available",
					earliestDay,
					skipped: [...skipped].map(([reason, skippedDay]) => ({
						day: skippedDay,
						reason,
					})),
				},
			});
			if (place(index + 1)) return true;
			placed.pop();
			today.pop();
			weeks[week] = used;
			if (!skipped.has("preserve-capacity"))
				skipped.set("preserve-capacity", day);
		}
		return false;
	}
	return place(0) ? placed : (jobs[furthest] as Job);
}
