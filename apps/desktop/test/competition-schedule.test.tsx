import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ScheduleDays,
	type ScheduleSlot,
} from "../src/renderer/competition/schedule-days";
import { createAppRouter } from "../src/renderer/router";
import { renderInLocale } from "./render-in-locale";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U4 (schedule and results) and U5 (a played series, read-only).

vi.setConfig({ testTimeout: 60_000 });

let scrolled: string[] = [];
beforeEach(() => {
	scrolled = [];
	// jsdom has no layout: record which day the schedule brings into view.
	Element.prototype.scrollIntoView = function (this: Element) {
		scrolled.push(this.getAttribute("data-day") ?? "");
	};
});

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

async function openSchedule(api = hostCore(), path = "/competicion") {
	await renderWithCore(<RouterProvider router={createAppRouter(path)} />, api);
	const user = userEvent.setup();
	await screen.findByRole(
		"list",
		{ name: "Competitions" },
		{ timeout: 30_000 },
	);
	return { user, api };
}

async function toSchedule(user: ReturnType<typeof userEvent.setup>) {
	await user.click(
		await screen.findByRole("button", { name: "Open Rift League" }),
	);
	await user.click(await screen.findByRole("radio", { name: "Schedule" }));
	return screen.findByRole("list", { name: "Match days" });
}

const days = () =>
	within(screen.getByRole("list", { name: "Match days" })).getAllByRole(
		"listitem",
		{ name: (_name, element) => element.hasAttribute("data-day") },
	);

describe("schedule (U4)", () => {
	it("lists the series by day, shows today and brings it into view", async () => {
		const { user } = await openSchedule();
		await toSchedule(user);
		const list = days();
		expect(list.length).toBeGreaterThan(1);
		const today = list.find((day) => day.getAttribute("aria-current"));
		expect(today?.getAttribute("data-day")).toBe("7");
		expect(within(today as HTMLElement).getByText("Today")).toBeTruthy();
		expect(scrolled.at(-1)).toBe("7");
		// Not played yet: the format instead of a score, and nothing to open.
		expect(within(today as HTMLElement).getAllByText("Bo1").length).toBe(
			within(today as HTMLElement).getAllByRole("listitem").length,
		);
		expect(within(today as HTMLElement).queryByRole("button")).toBeNull();
		// Playoffs before their stage starts: the rival is a text, not an id.
		expect(screen.getAllByText("To be decided").length).toBeGreaterThan(0);
	});

	it("filters by team and by competition", async () => {
		const { user } = await openSchedule();
		await toSchedule(user);
		const all = screen.getAllByText(/^(Bo1|To be decided)$/).length;
		await user.click(screen.getByRole("combobox", { name: "Team" }));
		await user.click(await screen.findByRole("option", { name: "Forge" }));
		await waitFor(() =>
			expect(screen.getAllByText(/^(Bo1|To be decided)$/).length).toBeLessThan(
				all,
			),
		);
		for (const day of days())
			for (const series of within(day).getAllByRole("listitem"))
				expect(series.textContent).toContain("Forge");

		const competition = screen.getByRole("combobox", { name: "Competition" });
		expect(competition.textContent).toContain("Rift League");
		// With every competition, each series says which one it belongs to.
		expect(
			within(days()[0] as HTMLElement).queryByText("Rift League"),
		).toBeNull();
		await user.click(competition);
		await user.click(
			await screen.findByRole("option", { name: "All competitions" }),
		);
		await waitFor(() =>
			expect(
				within(days()[0] as HTMLElement).getAllByText("Rift League").length,
			).toBeGreaterThan(0),
		);
	});

	it("shows the results with the winner in bold and opens a played series read-only (U5)", async () => {
		const { user } = await openSchedule();
		await user.click(screen.getByRole("button", { name: "Play day" }));
		await waitFor(() =>
			expect(screen.getByText(/^Matchday 1 of \d+$/)).toBeTruthy(),
		);
		await toSchedule(user);
		const played = days().find((day) => day.getAttribute("data-day") === "7");
		const [open] = within(played as HTMLElement).getAllByRole("button", {
			name: /^Open series: \w+ 1–0 \w+$/,
		});
		if (!open) throw new Error("no played series");
		const winner = within(open).getByText(/\w+/, { selector: "strong" });
		expect(open.getAttribute("aria-label")).toContain(
			`${winner.textContent} 1–0`,
		);

		await user.click(open);
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: /^\w+ vs \w+$/,
			}),
		).toBeTruthy();
		expect(
			await screen.findByRole("tab", { name: "Full series" }),
		).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Map 1" })).toBeTruthy();
		expect(screen.getByText("Series MVP")).toBeTruthy();
		// Read-only: nothing to play again.
		expect(screen.queryByRole("button", { name: /New series/ })).toBeNull();
		await user.click(screen.getByRole("tab", { name: "Map 1" }));
		expect(await screen.findByText(/^Map 1/)).toBeTruthy();
	});

	it("Back returns to the schedule as it was: filter and day", async () => {
		const { user } = await openSchedule();
		await user.click(screen.getByRole("button", { name: "Play day" }));
		await waitFor(() =>
			expect(screen.getByText(/^Matchday 1 of \d+$/)).toBeTruthy(),
		);
		await toSchedule(user);
		await user.click(screen.getByRole("combobox", { name: "Team" }));
		await user.click(await screen.findByRole("option", { name: "Forge" }));
		const open = await screen.findByRole("button", {
			name: /^Open series: .*Forge/,
		});
		await user.click(open);
		await screen.findByRole("tab", { name: "Full series" });
		scrolled = [];

		await user.click(screen.getByRole("button", { name: "Back" }));
		await screen.findByRole("list", { name: "Match days" });
		expect(
			(screen.getByRole("radio", { name: "Schedule" }) as HTMLInputElement)
				.checked,
		).toBe(true);
		expect(
			screen.getByRole("combobox", { name: "Team" }).textContent,
		).toContain("Forge");
		await waitFor(() => expect(scrolled.at(-1)).toBe("7"));
	});

	it("a series that does not exist says so in words", async () => {
		await renderWithCore(
			<RouterProvider router={createAppRouter("/competicion/serie/nope")} />,
			hostCore(),
		);
		expect(
			await screen.findByText(
				"That series does not exist or has not been played yet.",
				undefined,
				{ timeout: 30_000 },
			),
		).toBeTruthy();
	});
});

describe("pending rivals (U4)", () => {
	const slot = (over: Partial<ScheduleSlot>): ScheduleSlot => ({
		id: "x",
		competition: "lck",
		stage: "playoffs",
		day: 40,
		teams: ["t1", "geng"],
		bestOf: 5,
		status: "ready",
		...over,
	});

	it("names where a pending team comes from, in Spanish too", async () => {
		const origin = (_slot: ScheduleSlot, index: 0 | 1) =>
			index === 0 ? "Ganador de Semifinal 1" : "";
		await renderInLocale(
			<ScheduleDays
				slots={[
					slot({ id: "a", teams: [null, "geng"], status: "pending" }),
					slot({
						id: "b",
						day: 38,
						status: "played",
						winner: "geng",
						score: [1, 3],
					}),
				]}
				today={40}
				showCompetition={false}
				team={(id) => ({ t1: "T1", geng: "Gen.G" })[id] ?? id}
				competition={(id) => id.toUpperCase()}
				origin={origin}
				onOpen={() => {}}
			/>,
			"es-ES",
		);
		expect(screen.getByText("Ganador de Semifinal 1")).toBeTruthy();
		expect(screen.getByText("Hoy")).toBeTruthy();
		const played = screen.getByRole("button", {
			name: "Ver serie: T1 1–3 Gen.G",
		});
		expect(within(played).getByText("Gen.G").tagName).toBe("STRONG");
		expect(within(played).getByText("T1").tagName).not.toBe("STRONG");
		// No middle dot anywhere (user rule, 26-11).
		expect(document.body.textContent).not.toContain("·");
	});
});
