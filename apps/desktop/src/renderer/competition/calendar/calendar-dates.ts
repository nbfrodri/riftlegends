// Dates of the calendar (#593) on the core's integer days: day 0 is the 1st of
// January of the season year (plan 12). Weeks start on Monday. Only `Intl` and
// UTC dates, so the system time zone never moves a day.

export type CalendarMode = "day" | "week" | "month";

const DAY_MS = 86_400_000;
const yearStart = (year: number) => Date.UTC(year, 0, 1);

const dateOf = (year: number, day: number) =>
	new Date(yearStart(year) + day * DAY_MS);

const dayOf = (year: number, time: number) =>
	Math.round((time - yearStart(year)) / DAY_MS);

/** Days of the season year (365 or 366). */
export const yearLength = (year: number) => dayOf(year, yearStart(year + 1));

/** 0 for Monday to 6 for Sunday. */
export const weekdayOf = (year: number, day: number) =>
	(dateOf(year, day).getUTCDay() + 6) % 7;

const weekStart = (year: number, day: number) => day - weekdayOf(year, day);

function monthBounds(year: number, day: number) {
	const date = dateOf(year, day);
	const [y, m] = [date.getUTCFullYear(), date.getUTCMonth()];
	return {
		first: dayOf(year, Date.UTC(y, m, 1)),
		last: dayOf(year, Date.UTC(y, m + 1, 1)) - 1,
	};
}

/** The first and last day shown by a view around `day`. */
export function periodOf(mode: CalendarMode, year: number, day: number) {
	if (mode === "day") return { first: day, last: day };
	if (mode === "week") {
		const first = weekStart(year, day);
		return { first, last: first + 6 };
	}
	return monthBounds(year, day);
}

/** The weeks of the month of `day`, Monday to Sunday, as rows of days. */
export function monthWeeks(year: number, day: number): number[][] {
	const { first, last } = monthBounds(year, day);
	const weeks: number[][] = [];
	for (let start = weekStart(year, first); start <= last; start += 7)
		weeks.push(Array.from({ length: 7 }, (_, i) => start + i));
	return weeks;
}

/** Clamps a day into the season year. */
export const clampDay = (year: number, day: number) =>
	Math.min(Math.max(day, 0), yearLength(year) - 1);

/**
 * The day one period before (-1) or after (+1): a day, a week, or the same day
 * of the other month (the 31st becomes the last day of a shorter one).
 */
export function stepDay(
	mode: CalendarMode,
	year: number,
	day: number,
	direction: -1 | 1,
) {
	if (mode === "day") return clampDay(year, day + direction);
	if (mode === "week") return clampDay(year, day + 7 * direction);
	const date = dateOf(year, day);
	const [y, m] = [date.getUTCFullYear(), date.getUTCMonth() + direction];
	const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
	return clampDay(
		year,
		dayOf(year, Date.UTC(y, m, Math.min(date.getUTCDate(), length))),
	);
}

/** Whether the period before (-1) or after (+1) still has days of the year. */
export function canStep(
	mode: CalendarMode,
	year: number,
	day: number,
	direction: -1 | 1,
) {
	const { first, last } = periodOf(mode, year, day);
	return direction < 0 ? first > 0 : last < yearLength(year) - 1;
}

const upperFirst = (text: string) =>
	text.charAt(0).toLocaleUpperCase() + text.slice(1);

const format = (language: string, options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });

/** The title of a view: a day, a week («9–15 de febrero de 2026») or a month. */
export function periodTitle(
	mode: CalendarMode,
	year: number,
	day: number,
	language: string,
) {
	if (mode === "day")
		return upperFirst(
			format(language, {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
			}).format(dateOf(year, day)),
		);
	if (mode === "month")
		return upperFirst(
			format(language, { month: "long", year: "numeric" }).format(
				dateOf(year, day),
			),
		);
	const { first, last } = periodOf("week", year, day);
	return format(language, {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).formatRange(dateOf(year, first), dateOf(year, last));
}

/** A day in words for the screen reader: «Tuesday, February 10». */
export const dayInWords = (year: number, day: number, language: string) =>
	format(language, { weekday: "long", day: "numeric", month: "long" }).format(
		dateOf(year, day),
	);

/** The short weekday name: «Mon», «lun». */
export const weekdayName = (year: number, day: number, language: string) =>
	format(language, { weekday: "short" }).format(dateOf(year, day));

/** The 1st of a month names its month («1 Feb»); other days only their number. */
export function dayNumber(year: number, day: number, language: string) {
	const date = dateOf(year, day);
	return date.getUTCDate() === 1
		? format(language, { day: "numeric", month: "short" }).format(date)
		: String(date.getUTCDate());
}
