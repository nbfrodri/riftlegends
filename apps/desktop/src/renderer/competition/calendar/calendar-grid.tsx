import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import {
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import type { ScheduleSlot } from "../schedule-view";
import {
	type CalendarMode,
	clampDay,
	dayInWords,
	dayNumber,
	monthWeeks,
	periodOf,
	stepDay,
	weekdayName,
	weekdayOf,
	yearLength,
} from "./calendar-dates";
import {
	isPlayed,
	middleText,
	type SeriesNames,
	seriesLabel,
	sideName,
} from "./series-text";

// The week and month views of the calendar (#593): a grid of days with one tab
// stop. Arrows move the day, Home and End go to the ends of its week, Page Up
// and Page Down change the period and Enter opens the day. The series inside a
// day open with the mouse; from the keyboard, through the day view.

/** Series lines a month cell shows before «N more». */
const MONTH_LINES = 3;

export interface GridProps {
	mode: Exclude<CalendarMode, "day">;
	year: number;
	today: number | null;
	/** The chosen day: the grid's only tab stop. */
	day: number;
	title: string;
	byDay: ReadonlyMap<number, readonly ScheduleSlot[]>;
	showCompetition: boolean;
	names: SeriesNames;
	/** Set when the keyboard moved the day, to follow it with the focus. */
	follow: { current: boolean };
	onDay: (day: number, mode?: CalendarMode) => void;
	onOpen: (slot: ScheduleSlot) => void;
}

const keySteps: Record<string, number> = {
	ArrowLeft: -1,
	ArrowRight: 1,
	ArrowUp: -7,
	ArrowDown: 7,
};

export function CalendarGrid(props: GridProps) {
	const { mode, year, day, title, follow, onDay } = props;
	const { i18n } = useTranslation();
	const grid = useRef<HTMLDivElement>(null);
	const weeks =
		mode === "week"
			? [
					Array.from(
						{ length: 7 },
						(_, i) => periodOf("week", year, day).first + i,
					),
				]
			: monthWeeks(year, day);
	const length = yearLength(year);

	useEffect(() => {
		if (!follow.current) return;
		follow.current = false;
		grid.current
			?.querySelector<HTMLElement>(`[role="gridcell"][data-day="${day}"]`)
			?.focus();
	}, [day, follow]);

	function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
		const target = event.target as HTMLElement;
		if (target.getAttribute("role") !== "gridcell") return;
		const weekday = weekdayOf(year, day);
		const next =
			event.key in keySteps
				? day + (keySteps[event.key] as number)
				: event.key === "Home"
					? day - weekday
					: event.key === "End"
						? day + 6 - weekday
						: event.key === "PageUp" || event.key === "PageDown"
							? stepDay(mode, year, day, event.key === "PageUp" ? -1 : 1)
							: undefined;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onDay(day, "day");
			return;
		}
		if (next === undefined) return;
		event.preventDefault();
		follow.current = true;
		onDay(clampDay(year, next));
	}

	return (
		<div ref={grid} className="scroll-edge min-h-0 flex-1 overflow-y-auto">
			<table
				// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA grid pattern (date grid) on a table.
				role="grid"
				aria-label={title}
				onKeyDown={onKeyDown}
				// Separate borders, drawn by each cell: collapsed ones belong to the
				// table, scroll away under the sticky day names and leave a gap (#608).
				className="h-full w-full table-fixed border-separate border-spacing-0"
			>
				<thead>
					<tr>
						{weeks[0]?.map((d) => (
							<th
								key={d}
								scope="col"
								className={cn(
									"sticky top-0 z-10 border-line border-t border-r border-b bg-panel first:border-l px-2 py-1.5 text-left font-semibold text-[12px] text-muted uppercase tracking-[0.055em]",
									d === props.today && "text-text",
								)}
							>
								{mode === "week"
									? `${weekdayName(year, d, i18n.language)} ${dayNumber(year, d, i18n.language)}`
									: weekdayName(year, d, i18n.language)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week) => (
						<tr
							key={week[0]}
							className={mode === "month" ? "h-[64px]" : undefined}
						>
							{week.map((d) =>
								d < 0 || d >= length ? (
									<td
										key={d}
										tabIndex={-1}
										// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a day outside the season year, never focused.
										role="gridcell"
										data-day={d}
										aria-disabled="true"
										className="border-line border-r border-b bg-bg first:border-l"
									/>
								) : (
									<DayCell key={d} {...props} cell={d} />
								),
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DayCell({
	cell,
	mode,
	year,
	day,
	today,
	byDay,
	showCompetition,
	names,
	onDay,
	onOpen,
}: GridProps & { cell: number }) {
	const { t, i18n } = useTranslation();
	const series = byDay.get(cell) ?? [];
	const isToday = cell === today;
	const inMonth =
		mode === "week" ||
		(cell >= periodOf("month", year, day).first &&
			cell <= periodOf("month", year, day).last);
	const shown =
		mode === "month" && series.length > MONTH_LINES
			? series.slice(0, MONTH_LINES - 1)
			: series;
	const hidden = series.length - shown.length;
	const stop = (event: MouseEvent) => event.stopPropagation();
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the grid handles the keys of its cells.
		<td
			// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA grid cell; the grid handles the keys.
			role="gridcell"
			data-day={cell}
			tabIndex={cell === day ? 0 : -1}
			aria-current={isToday ? "date" : undefined}
			aria-label={t(
				series.length
					? "competition.calendar.daySeries"
					: "competition.calendar.dayEmpty",
				{
					date: dayInWords(year, cell, i18n.language),
					count: series.length,
				},
			)}
			onClick={() => onDay(cell)}
			className={cn(
				"cursor-pointer border-line border-r border-b p-1.5 align-top first:border-l outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-action",
				isToday ? "bg-surface" : "bg-panel",
			)}
		>
			<div className="flex min-w-0 flex-col gap-1">
				{(mode === "month" || isToday) && (
					<div className="flex items-baseline gap-2 text-[12px]">
						{mode === "month" && (
							<button
								type="button"
								tabIndex={-1}
								aria-label={t("competition.calendar.openDay", {
									date: dayInWords(year, cell, i18n.language),
								})}
								onClick={(event) => {
									stop(event);
									onDay(cell, "day");
								}}
								className={cn(
									"press cursor-pointer px-0.5 font-semibold tabular-nums hover:bg-line",
									isToday || inMonth ? "text-text" : "text-muted",
								)}
							>
								{dayNumber(year, cell, i18n.language)}
							</button>
						)}
						{isToday && (
							<span className="font-semibold text-text">
								{t("competition.schedule.today")}
							</span>
						)}
					</div>
				)}
				{shown.map((slot) =>
					mode === "week" ? (
						<WeekBlock
							key={slot.id}
							slot={slot}
							names={names}
							showCompetition={showCompetition}
							onOpen={onOpen}
						/>
					) : (
						<MonthLine
							key={slot.id}
							slot={slot}
							names={names}
							onOpen={onOpen}
						/>
					),
				)}
				{hidden > 0 && (
					<button
						type="button"
						tabIndex={-1}
						onClick={(event) => {
							stop(event);
							onDay(cell, "day");
						}}
						className="press cursor-pointer self-start px-0.5 text-[12px] text-muted hover:bg-line hover:text-text"
					>
						{t("competition.calendar.more", { count: hidden })}
					</button>
				)}
			</div>
		</td>
	);
}

interface SeriesProps {
	slot: ScheduleSlot;
	names: SeriesNames;
	onOpen: (slot: ScheduleSlot) => void;
}

/** A played series opens on click; the others are only shown. */
function Openable({
	slot,
	names,
	className,
	children,
	onOpen,
}: SeriesProps & { className: string; children: ReactNode }) {
	const { t } = useTranslation();
	const label = seriesLabel(t, names, slot);
	const where = t("competition.calendar.where", {
		competition: names.competition(slot.competition),
		stage: names.stage(slot),
	});
	return (
		<Tooltip heading={where} content={label}>
			{isPlayed(slot) ? (
				<button
					type="button"
					tabIndex={-1}
					data-series={slot.id}
					aria-label={label}
					onClick={(event) => {
						event.stopPropagation();
						onOpen(slot);
					}}
					className={cn(
						className,
						"press w-full cursor-pointer text-left hover:bg-line",
					)}
				>
					{children}
				</button>
			) : (
				<div data-series={slot.id} className={className}>
					{children}
				</div>
			)}
		</Tooltip>
	);
}

function WeekBlock({
	slot,
	names,
	showCompetition,
	onOpen,
}: SeriesProps & { showCompetition: boolean }) {
	const { t } = useTranslation();
	const played = isPlayed(slot);
	return (
		<Openable
			slot={slot}
			names={names}
			onOpen={onOpen}
			className="grid gap-0.5 border border-line bg-panel px-1.5 py-1 text-[13px]"
		>
			{(showCompetition || !played) && (
				<span className="flex min-w-0 justify-between gap-2 text-[11px] text-muted">
					<span className="truncate">
						{showCompetition ? names.competition(slot.competition) : ""}
					</span>
					{!played && <span>{middleText(t, slot)}</span>}
				</span>
			)}
			<TeamLine slot={slot} names={names} index={0} />
			<TeamLine slot={slot} names={names} index={1} />
		</Openable>
	);
}

function TeamLine({
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
	const name = sideName(t, names, slot, index, true);
	const won = slot.winner !== undefined && slot.winner === id;
	const lost = slot.winner !== undefined && !won;
	return (
		<span className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-1.5">
			{id ? <TeamCrest id={id} name={name} className="h-4 w-4" /> : <span />}
			{won ? (
				<strong className="truncate font-bold">{name}</strong>
			) : (
				<span className={cn("truncate", (lost || !id) && "text-muted")}>
					{name}
				</span>
			)}
			<span className={cn("font-display tabular-nums", lost && "text-muted")}>
				{slot.score?.[index] ?? ""}
			</span>
		</span>
	);
}

function MonthLine({ slot, names, onOpen }: SeriesProps) {
	const { t } = useTranslation();
	const side = (index: 0 | 1) => {
		const id = slot.teams[index];
		const name = sideName(t, names, slot, index, true);
		const won = slot.winner !== undefined && slot.winner === id;
		return (
			<span
				className={cn(
					"flex min-w-0 items-center gap-1",
					index === 0 && "flex-row-reverse justify-start text-right",
				)}
			>
				{id && <TeamCrest id={id} name={name} className="h-3.5 w-3.5" />}
				{won ? (
					<strong className="truncate font-bold">{name}</strong>
				) : (
					<span
						className={cn(
							"truncate",
							(slot.winner !== undefined || !id) && "text-muted",
						)}
					>
						{name}
					</span>
				)}
			</span>
		);
	};
	return (
		<Openable
			slot={slot}
			names={names}
			onOpen={onOpen}
			className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-0.5 text-[12px] leading-[1.35]"
		>
			{side(0)}
			<span className="text-muted tabular-nums">{middleText(t, slot)}</span>
			{side(1)}
		</Openable>
	);
}
