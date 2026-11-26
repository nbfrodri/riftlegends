import type { useTranslation } from "react-i18next";
import type { ScheduleSlot } from "../schedule-view";

type TFunction = ReturnType<typeof useTranslation>["t"];

// What the calendar says about a series (#593): names, format and the label a
// screen reader hears, shared by the three views.

interface CalendarTeam {
	readonly name: string;
	/** The content's short name (HLE, T1), shown where room is tight. */
	readonly short?: string | undefined;
}

export interface SeriesNames {
	team: (id: string) => CalendarTeam;
	competition: (id: string) => string;
	/** Where a team not known yet comes from; empty when nothing says it. */
	origin: (slot: ScheduleSlot, index: 0 | 1, short: boolean) => string;
}

export const isPlayed = (slot: ScheduleSlot) =>
	slot.status === "played" && slot.score !== undefined;

/** A team of a series: its name (or short name), or where it comes from. */
export function sideName(
	t: TFunction,
	names: SeriesNames,
	slot: ScheduleSlot,
	index: 0 | 1,
	short: boolean,
) {
	const id = slot.teams[index];
	if (id) {
		const team = names.team(id);
		return short ? (team.short ?? team.name) : team.name;
	}
	return (
		names.origin(slot, index, short) || t("competition.schedule.toBeDecided")
	);
}

/** «2–1» once played, else «Bo3» (or nothing without a format). */
export const middleText = (t: TFunction, slot: ScheduleSlot) =>
	slot.score
		? `${slot.score[0]}–${slot.score[1]}`
		: slot.bestOf
			? t("competition.bracket.bestOf", { n: slot.bestOf })
			: "";

/** The series in words: «Open series: T1 1–2 Gen.G» or «T1 vs Gen.G, Bo3». */
export function seriesLabel(
	t: TFunction,
	names: SeriesNames,
	slot: ScheduleSlot,
) {
	const [a, b] = [
		sideName(t, names, slot, 0, false),
		sideName(t, names, slot, 1, false),
	];
	if (slot.score)
		return t("competition.schedule.open", {
			a,
			b,
			scoreA: slot.score[0],
			scoreB: slot.score[1],
		});
	const title = t("competition.series.title", { a, b });
	return slot.bestOf
		? t("competition.calendar.upcoming", {
				series: title,
				format: middleText(t, slot),
			})
		: title;
}
