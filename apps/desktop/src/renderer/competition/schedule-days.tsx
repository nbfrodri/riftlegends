import type { ScheduleView } from "@rift-legends/contracts";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../draft/team-crest";
import { dayDate, stageName } from "./names";

// The schedule of plan 31 (U4): the series grouped by day, with the result of
// those already played. A played series opens on click; the others are text.

/** One series of `competition.schedule`. */
export type ScheduleSlot = ScheduleView[number];

export function ScheduleDays({
	slots,
	year,
	today,
	focusDay,
	showCompetition,
	team,
	competition,
	origin,
	onOpen,
}: {
	slots: readonly ScheduleSlot[];
	year: number;
	/** The next day to play; `null` once the season is over. */
	today: number | null;
	/** The day to bring into view instead of today (coming back from a series). */
	focusDay?: number | undefined;
	/** Names the competition of each series, when several are listed. */
	showCompetition: boolean;
	team: (id: string) => string;
	competition: (id: string) => string;
	/** Where a team not known yet comes from; empty when nothing says it. */
	origin: (slot: ScheduleSlot, index: 0 | 1) => string;
	onOpen: (slot: ScheduleSlot) => void;
}) {
	const { t, i18n } = useTranslation();
	const list = useRef<HTMLOListElement>(null);
	const days = useMemo(() => {
		const byDay = new Map<number, ScheduleSlot[]>();
		for (const slot of slots)
			byDay.set(slot.day, [...(byDay.get(slot.day) ?? []), slot]);
		return [...byDay].sort(([a], [b]) => a - b);
	}, [slots]);

	const target = focusDay ?? today;
	const ready = days.length > 0;
	// Once per opening: today (or the day left) at the top of the list.
	useEffect(() => {
		if (!ready) return;
		const items = [
			...(list.current?.querySelectorAll<HTMLElement>(":scope > li") ?? []),
		];
		const shown =
			target === null
				? items.at(-1)
				: (items.find((item) => Number(item.dataset.day) >= target) ??
					items.at(-1));
		shown?.scrollIntoView?.({ block: "start" });
	}, [ready, target]);

	if (!ready)
		return <p className="text-muted">{t("competition.schedule.empty")}</p>;

	const name = (slot: ScheduleSlot, index: 0 | 1) => {
		const id = slot.teams[index];
		return id
			? team(id)
			: origin(slot, index) || t("competition.schedule.toBeDecided");
	};
	const columns = showCompetition
		? "grid-cols-[minmax(0,9rem)_minmax(0,8rem)_minmax(0,1fr)_4.5rem_minmax(0,1fr)]"
		: "grid-cols-[minmax(0,8rem)_minmax(0,1fr)_4.5rem_minmax(0,1fr)]";

	return (
		<ol
			ref={list}
			aria-label={t("competition.schedule.days")}
			className="scroll-edge grid min-h-0 content-start gap-3 overflow-y-auto"
		>
			{days.map(([day, series]) => (
				<li
					key={day}
					data-day={day}
					aria-current={day === today ? "date" : undefined}
					aria-labelledby={`schedule-day-${day}`}
					className="grid gap-1"
				>
					<h3
						id={`schedule-day-${day}`}
						className="flex items-baseline gap-3 font-semibold text-[13px] text-muted uppercase tracking-[0.055em]"
					>
						<span className={cn(day === today && "text-text")}>
							{t("competition.today", {
								day,
								date: dayDate(year, day, i18n.language),
							})}
						</span>
						{day === today && (
							<span className="text-text">
								{t("competition.schedule.today")}
							</span>
						)}
					</h3>
					<ol className="grid gap-px">
						{series.map((slot) => {
							const [a, b] = [name(slot, 0), name(slot, 1)];
							const cells = (
								<>
									{showCompetition && (
										<span className="truncate text-muted">
											{competition(slot.competition)}
										</span>
									)}
									<span className="truncate text-muted">
										{stageName(slot.stage)}
									</span>
									<Side slot={slot} index={0} label={a} />
									<span className="text-center font-display tabular-nums">
										{slot.score
											? `${slot.score[0]}–${slot.score[1]}`
											: slot.bestOf
												? t("competition.bracket.bestOf", { n: slot.bestOf })
												: ""}
									</span>
									<Side slot={slot} index={1} label={b} />
								</>
							);
							const row = cn(
								"grid w-full items-center gap-4 bg-panel px-3 py-2 text-left text-[14px]",
								columns,
							);
							return (
								<li key={slot.id}>
									{slot.status === "played" && slot.score ? (
										<button
											type="button"
											aria-label={t("competition.schedule.open", {
												a,
												b,
												scoreA: slot.score[0],
												scoreB: slot.score[1],
											})}
											onClick={() => onOpen(slot)}
											className={cn(
												row,
												"press cursor-pointer outline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action",
											)}
										>
											{cells}
										</button>
									) : (
										<div className={row}>{cells}</div>
									)}
								</li>
							);
						})}
					</ol>
				</li>
			))}
		</ol>
	);
}

/** One team of a series: logo and name, the winner in bold; mirrored on the right. */
function Side({
	slot,
	index,
	label,
}: {
	slot: ScheduleSlot;
	index: 0 | 1;
	label: string;
}) {
	const id = slot.teams[index];
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
