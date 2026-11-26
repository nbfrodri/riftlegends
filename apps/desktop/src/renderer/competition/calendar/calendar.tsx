import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { type KeyboardEvent, type ReactNode, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import { stageName } from "../names";
import type { ScheduleSlot } from "../schedule-view";
import {
	type CalendarMode,
	canStep,
	clampDay,
	periodTitle,
	stepDay,
} from "./calendar-dates";
import { CalendarGrid } from "./calendar-grid";
import {
	isPlayed,
	middleText,
	type SeriesNames,
	seriesLabel,
	sideName,
} from "./series-text";

export type { CalendarMode } from "./calendar-dates";

// The season calendar (#593), like a desk calendar with three views: a day, a
// week and a month. Where it is (view and day) belongs to the caller, so the
// route can keep it while a series is open.

export interface CalendarPlace {
	readonly mode: CalendarMode;
	/** The chosen day; without one the calendar follows today. */
	readonly day?: number | undefined;
}

export function Calendar({
	slots,
	year,
	today,
	place,
	onPlace,
	showCompetition,
	team,
	competition,
	origin,
	onOpen,
	children,
}: SeriesNames & {
	slots: readonly ScheduleSlot[];
	year: number;
	/** The next day to play; `null` once the season is over. */
	today: number | null;
	place: CalendarPlace;
	onPlace: (place: CalendarPlace) => void;
	/** Names the competition of each series, when several are shown. */
	showCompetition: boolean;
	onOpen: (slot: ScheduleSlot) => void;
	/** Filters, on the toolbar before the views. */
	children?: ReactNode;
}) {
	const { t, i18n } = useTranslation();
	const follow = useRef(false);
	const byDay = useMemo(() => {
		const days = new Map<number, ScheduleSlot[]>();
		for (const slot of slots)
			days.set(slot.day, [...(days.get(slot.day) ?? []), slot]);
		return days;
	}, [slots]);
	const names = { team, competition, origin };
	const { mode } = place;
	const day = clampDay(year, place.day ?? today ?? slots.at(-1)?.day ?? 0);
	const title = periodTitle(mode, year, day, i18n.language);
	const move = (direction: -1 | 1) =>
		onPlace({ mode, day: stepDay(mode, year, day, direction) });

	return (
		<section
			aria-label={t("competition.calendar.label")}
			className="flex min-h-0 flex-1 flex-col gap-3"
		>
			<div className="flex flex-wrap items-center gap-3">
				{children}
				<SegmentedControl
					label={t("competition.calendar.view")}
					options={(["day", "week", "month"] as const).map((value) => ({
						value,
						label: t(`competition.calendar.${value}`),
					}))}
					value={mode}
					onChange={(next) => onPlace({ mode: next, day: place.day })}
					className="ml-auto"
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="secondary" onClick={() => onPlace({ mode })}>
					{t("competition.calendar.today")}
				</Button>
				<Button
					variant="secondary"
					disabled={!canStep(mode, year, day, -1)}
					onClick={() => move(-1)}
				>
					{t("competition.calendar.previous")}
				</Button>
				<Button
					variant="secondary"
					disabled={!canStep(mode, year, day, 1)}
					onClick={() => move(1)}
				>
					{t("competition.calendar.next")}
				</Button>
				<h2
					aria-live="polite"
					className="ml-2 min-w-0 truncate font-bold font-display text-[clamp(16px,1.45vw,23px)] tracking-[-0.045em]"
				>
					{title}
				</h2>
			</div>
			{mode === "day" ? (
				<DayList
					key={day}
					title={title}
					series={byDay.get(day) ?? []}
					showCompetition={showCompetition}
					names={names}
					onOpen={onOpen}
				/>
			) : (
				<CalendarGrid
					mode={mode}
					year={year}
					today={today}
					day={day}
					title={title}
					byDay={byDay}
					showCompetition={showCompetition}
					names={names}
					follow={follow}
					onDay={(next, nextMode = mode) =>
						onPlace({ mode: nextMode, day: next })
					}
					onOpen={onOpen}
				/>
			)}
		</section>
	);
}

const listKeys: Record<string, (index: number, count: number) => number> = {
	ArrowDown: (index, count) => Math.min(index + 1, count - 1),
	ArrowUp: (index) => Math.max(index - 1, 0),
	Home: () => 0,
	End: (_index, count) => count - 1,
};

/** The series of one day, one row each, with one tab stop (arrows move). */
function DayList({
	title,
	series,
	showCompetition,
	names,
	onOpen,
}: {
	title: string;
	series: readonly ScheduleSlot[];
	showCompetition: boolean;
	names: SeriesNames;
	onOpen: (slot: ScheduleSlot) => void;
}) {
	const { t } = useTranslation();
	const list = useRef<HTMLOListElement>(null);
	if (series.length === 0)
		return <p className="text-muted">{t("competition.calendar.empty")}</p>;

	function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
		const move = listKeys[event.key];
		const rows = [
			...(list.current?.querySelectorAll<HTMLElement>(
				":scope > li > [data-series]",
			) ?? []),
		];
		const index = rows.indexOf(event.target as HTMLElement);
		if (!move || index < 0) return;
		event.preventDefault();
		const next = rows[move(index, rows.length)];
		for (const row of rows) row.tabIndex = row === next ? 0 : -1;
		next?.focus();
	}

	const columns = showCompetition
		? "grid-cols-[minmax(0,9rem)_minmax(0,8rem)_minmax(0,1fr)_4.5rem_minmax(0,1fr)]"
		: "grid-cols-[minmax(0,8rem)_minmax(0,1fr)_4.5rem_minmax(0,1fr)]";
	return (
		<ol
			ref={list}
			aria-label={title}
			onKeyDown={onKeyDown}
			className="scroll-edge grid min-h-0 content-start gap-px overflow-y-auto"
		>
			{series.map((slot, index) => {
				const label = seriesLabel(t, names, slot);
				const cells = (
					<>
						{showCompetition && (
							<span className="truncate text-muted">
								{names.competition(slot.competition)}
							</span>
						)}
						<span className="truncate text-muted">{stageName(slot.stage)}</span>
						<Side slot={slot} names={names} index={0} />
						<span className="text-center font-display tabular-nums">
							{middleText(t, slot)}
						</span>
						<Side slot={slot} names={names} index={1} />
					</>
				);
				const row = cn(
					"grid w-full items-center gap-4 bg-panel px-3 py-2 text-left text-[14px] outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-action",
					columns,
				);
				const common = {
					"data-series": slot.id,
					"aria-label": label,
					tabIndex: index === 0 ? 0 : -1,
				};
				return (
					<li key={slot.id}>
						{isPlayed(slot) ? (
							<button
								type="button"
								{...common}
								onClick={() => onOpen(slot)}
								className={cn(row, "press cursor-pointer hover:bg-surface")}
							>
								{cells}
							</button>
						) : (
							<div {...common} className={row}>
								{cells}
							</div>
						)}
					</li>
				);
			})}
		</ol>
	);
}

/** One team of a series: logo and name, the winner in bold; mirrored on the left. */
function Side({
	slot,
	names,
	index,
}: {
	slot: ScheduleSlot;
	names: SeriesNames;
	index: 0 | 1;
}) {
	const { t } = useTranslation();
	const id = slot.teams[index];
	const label = sideName(t, names, slot, index, false);
	const won = slot.winner !== undefined && slot.winner === id;
	const lost = slot.winner !== undefined && !won;
	return (
		<span
			className={cn(
				"flex min-w-0 items-center gap-2",
				index === 0 && "flex-row-reverse text-right",
			)}
		>
			{id ? (
				<TeamCrest id={id} name={label} className="h-5 w-7 shrink-0" />
			) : null}
			{won ? (
				<strong className="truncate font-bold">{label}</strong>
			) : (
				<span className={cn("truncate", (lost || !id) && "text-muted")}>
					{label}
				</span>
			)}
		</span>
	);
}
