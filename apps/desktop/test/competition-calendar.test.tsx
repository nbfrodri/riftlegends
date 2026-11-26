import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	Calendar,
	type CalendarPlace,
} from "../src/renderer/competition/calendar/calendar";
import type { ScheduleSlot } from "../src/renderer/competition/schedule-view";
import { renderInLocale } from "./render-in-locale";

// #593: the calendar of the season in three views, day, week and month. Day 0
// is the 1st of January 2026 (a Thursday); day 40 is Tuesday 10 February.

afterEach(cleanup);

const slot = (over: Partial<ScheduleSlot>): ScheduleSlot => ({
	id: "x",
	competition: "lck",
	stage: "rounds-1-2",
	day: 40,
	teams: ["t1", "geng"],
	bestOf: 3,
	status: "ready",
	...over,
});

const slots: ScheduleSlot[] = [
	slot({
		id: "played",
		day: 39,
		status: "played",
		winner: "geng",
		score: [1, 2],
	}),
	slot({ id: "today", day: 40, teams: ["t1", "hle"] }),
	slot({ id: "lec", day: 40, competition: "lec", teams: ["g2", "fnc"] }),
	slot({ id: "later", day: 44, teams: ["hle", "geng"] }),
	...["a", "b", "c", "d"].map((id) =>
		slot({ id: `busy-${id}`, day: 50, teams: ["t1", "geng"] }),
	),
	slot({ id: "pending", day: 52, teams: [null, "geng"], status: "pending" }),
];

const teams: Record<string, { name: string; short?: string }> = {
	t1: { name: "T1" },
	geng: { name: "Gen.G", short: "GEN" },
	hle: { name: "Hanwha Life Esports", short: "HLE" },
	g2: { name: "G2 Esports", short: "G2" },
	fnc: { name: "Fnatic", short: "FNC" },
};

function Harness({
	mode,
	day,
	onOpen = () => {},
	today = 40,
	showCompetition = true,
}: CalendarPlace & {
	onOpen?: (slot: ScheduleSlot) => void;
	today?: number | null;
	showCompetition?: boolean;
}) {
	const [place, setPlace] = useState<CalendarPlace>({ mode, day });
	return (
		<Calendar
			slots={slots}
			year={2026}
			today={today}
			place={place}
			onPlace={setPlace}
			showCompetition={showCompetition}
			team={(id) => teams[id] ?? { name: id }}
			competition={(id) => id.toUpperCase()}
			stage={(slot) =>
				slot.stage === "rounds-1-2" ? "Winter Split, Rounds 1-2" : slot.stage
			}
			origin={(_slot, index, short) =>
				index === 0 ? (short ? "Ganador SF1" : "Ganador de Semifinal 1") : ""
			}
			onOpen={onOpen}
		/>
	);
}

async function show(props: Parameters<typeof Harness>[0], locale?: string) {
	await renderInLocale(<Harness {...props} />, locale);
	return userEvent.setup();
}

const grid = () => screen.getByRole("grid");
const cell = (day: number) =>
	grid().querySelector<HTMLElement>(`[role="gridcell"][data-day="${day}"]`);
const title = () => screen.getByRole("heading", { level: 2 });

describe("week view", () => {
	it("shows the seven days of today's week with today marked", async () => {
		await show({ mode: "week" });
		expect(title().textContent).toMatch(/^February 9\s?–\s?15, 2026$/);
		expect(
			within(grid())
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual([
			"Mon 9",
			"Tue 10",
			"Wed 11",
			"Thu 12",
			"Fri 13",
			"Sat 14",
			"Sun 15",
		]);
		const today = cell(40) as HTMLElement;
		expect(today.getAttribute("aria-current")).toBe("date");
		expect(within(today).getByText("Today")).toBeTruthy();
		// Short names, the format before the series is played, and the competition.
		expect(within(today).getAllByText("HLE").length).toBe(1);
		expect(within(today).getAllByText("Bo3").length).toBe(2);
		expect(within(today).getByText("LEC")).toBeTruthy();
		expect(today.getAttribute("aria-label")).toBe(
			"Tuesday, February 10, 2 series",
		);
		expect(document.body.textContent).not.toContain("·");
	});

	it("moves a week back and forth and comes back to today", async () => {
		const user = await show({ mode: "week" });
		await user.click(screen.getByRole("button", { name: "Next" }));
		expect(title().textContent).toMatch(/^February 16\s?–\s?22, 2026$/);
		expect(cell(40)).toBeNull();
		expect(within(cell(50) as HTMLElement).getAllByText("GEN").length).toBe(4);
		await user.click(screen.getByRole("button", { name: "Previous" }));
		await user.click(screen.getByRole("button", { name: "Previous" }));
		expect(title().textContent).toMatch(/^February 2\s?–\s?8, 2026$/);
		await user.click(screen.getByRole("button", { name: "Today" }));
		expect(title().textContent).toMatch(/^February 9\s?–\s?15, 2026$/);
	});

	it("opens a played series with the winner in bold; others do not open", async () => {
		const open = vi.fn();
		const user = await show({ mode: "week", onOpen: open });
		const played = within(cell(39) as HTMLElement).getByRole("button", {
			name: "Open series: T1 1–2 Gen.G",
		});
		expect(within(played).getByText("GEN").tagName).toBe("STRONG");
		expect(within(played).getByText("T1").tagName).not.toBe("STRONG");
		await user.click(played);
		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({ id: "played" }),
		);
		expect(within(cell(40) as HTMLElement).queryByRole("button")).toBeNull();
	});

	it("is one tab stop: arrows move the day and cross into the next week", async () => {
		const user = await show({ mode: "week" });
		const stops = grid().querySelectorAll('[role="gridcell"][tabindex="0"]');
		expect([...stops].map((stop) => stop.getAttribute("data-day"))).toEqual([
			"40",
		]);
		(cell(40) as HTMLElement).focus();
		await user.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(cell(41));
		await user.keyboard("{End}{ArrowRight}");
		expect(title().textContent).toMatch(/^February 16\s?–\s?22, 2026$/);
		expect(document.activeElement).toBe(cell(46));
		await user.keyboard("{ArrowUp}");
		expect(document.activeElement).toBe(cell(39));
		// Enter opens the day.
		await user.keyboard("{Enter}");
		expect(title().textContent).toBe("Monday, February 9, 2026");
		expect(
			(screen.getByRole("radio", { name: "Day" }) as HTMLInputElement).checked,
		).toBe(true);
	});
});

describe("month view", () => {
	it("lays out the weeks of the month and sends the busy days to the day view", async () => {
		const user = await show({ mode: "month" });
		expect(title().textContent).toBe("February 2026");
		const rows = within(grid()).getAllByRole("row");
		// A header row and the five weeks from 26 January to 1 March.
		expect(rows.length).toBe(6);
		expect(cell(25)?.getAttribute("aria-label")).toBe(
			"Monday, January 26, no series",
		);
		const busy = cell(50) as HTMLElement;
		expect(within(busy).getAllByText("GEN").length).toBe(2);
		await user.click(within(busy).getByRole("button", { name: "2 more" }));
		expect(title().textContent).toBe("Friday, February 20, 2026");
		expect(screen.getAllByRole("listitem").length).toBe(4);
	});

	it("moves a month at a time and stops at the edges of the season year", async () => {
		const user = await show({ mode: "month" });
		await user.click(screen.getByRole("button", { name: "Previous" }));
		expect(title().textContent).toBe("January 2026");
		expect(
			screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
		).toBe(true);
		// Days of the previous year are not in the season.
		expect(cell(-3)?.getAttribute("aria-disabled")).toBe("true");
		await user.click(screen.getByRole("button", { name: "Today" }));
		expect(title().textContent).toBe("February 2026");
	});
});

describe("day view", () => {
	it("lists the series of the day with competition, stage and teams", async () => {
		const open = vi.fn();
		const user = await show({ mode: "day", day: 39, onOpen: open });
		expect(title().textContent).toBe("Monday, February 9, 2026");
		const [played] = screen.getAllByRole("listitem");
		expect(within(played as HTMLElement).getByText("LCK")).toBeTruthy();
		expect(
			within(played as HTMLElement).getByText("Winter Split, Rounds 1-2"),
		).toBeTruthy();
		await user.click(
			screen.getByRole("button", { name: "Open series: T1 1–2 Gen.G" }),
		);
		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({ id: "played" }),
		);
		await user.click(screen.getByRole("button", { name: "Next" }));
		expect(title().textContent).toBe("Tuesday, February 10, 2026");
		expect(screen.getAllByRole("listitem").length).toBe(2);
		await user.click(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByText("No series this day.")).toBeTruthy();
	});

	it("is one tab stop: arrows move between the series and Enter opens a played one", async () => {
		const open = vi.fn();
		const user = await show({ mode: "day", day: 50, onOpen: open });
		const list = screen.getByRole("list", { name: /February 20/ });
		const rows = within(list)
			.getAllByRole("listitem")
			.map((item) => item.firstElementChild as HTMLElement);
		expect(rows.map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
		rows[0]?.focus();
		await user.keyboard("{ArrowDown}{ArrowDown}");
		expect(document.activeElement).toBe(rows[2]);
		expect(rows[2]?.getAttribute("aria-label")).toBe("T1 vs Gen.G, Bo3");
		await user.keyboard("{End}");
		expect(document.activeElement).toBe(rows[3]);
	});

	it("names where a pending team comes from, in Spanish", async () => {
		await show({ mode: "day", day: 52 }, "es-ES");
		expect(title().textContent).toBe("Domingo, 22 de febrero de 2026");
		expect(screen.getByText("Ganador de Semifinal 1")).toBeTruthy();
		expect(document.body.textContent).not.toContain("·");
	});

	it("follows today when nothing else is chosen, and the last day once the season is over", async () => {
		await show({ mode: "day" });
		expect(title().textContent).toBe("Tuesday, February 10, 2026");
		cleanup();
		await show({ mode: "day", today: null });
		expect(title().textContent).toBe("Sunday, February 22, 2026");
	});
});

describe("views", () => {
	it("switches between day, week and month keeping the day", async () => {
		const user = await show({ mode: "week", day: 50 });
		await user.click(screen.getByRole("radio", { name: "Month" }));
		expect(title().textContent).toBe("February 2026");
		await user.click(screen.getByRole("radio", { name: "Day" }));
		expect(title().textContent).toBe("Friday, February 20, 2026");
	});

	it("speaks Spanish", async () => {
		await show({ mode: "week" }, "es-ES");
		expect(title().textContent).toMatch(/^9\s?–\s?15 de febrero de 2026$/);
		expect(screen.getByRole("button", { name: "Hoy" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Anterior" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Siguiente" })).toBeTruthy();
		expect(screen.getByRole("radio", { name: "Semana" })).toBeTruthy();
		expect(cell(40)?.getAttribute("aria-label")).toBe(
			"martes, 10 de febrero, 2 series",
		);
		expect(document.body.textContent).not.toContain("·");
	});
});
