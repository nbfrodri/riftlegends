import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U4 (schedule and results) and U5 (a played series, read-only), with
// the calendar of #593. The calendar's own views: competition-calendar.test.

vi.setConfig({ testTimeout: 60_000 });

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
	return screen.findByRole("grid");
}

const cell = (day: number) =>
	screen
		.getByRole("grid")
		.querySelector<HTMLElement>(`[role="gridcell"][data-day="${day}"]`);
const blocks = () => [
	...screen.getByRole("grid").querySelectorAll<HTMLElement>("[data-series]"),
];

describe("schedule (U4, #593)", () => {
	it("opens on today's week with today marked and the format of each series", async () => {
		const { user } = await openSchedule();
		await toSchedule(user);
		const today = cell(7) as HTMLElement;
		expect(today.getAttribute("aria-current")).toBe("date");
		expect(within(today).getByText("Today")).toBeTruthy();
		expect(
			(screen.getByRole("radio", { name: "Week" }) as HTMLInputElement).checked,
		).toBe(true);
		// Not played yet: the format instead of a score, and nothing to open.
		expect(within(today).getAllByText("Bo1").length).toBe(
			today.querySelectorAll("[data-series]").length,
		);
		expect(within(today).queryByRole("button")).toBeNull();
	});

	it("filters by team and by competition", async () => {
		const { user } = await openSchedule();
		await toSchedule(user);
		await user.click(screen.getByRole("radio", { name: "Month" }));
		const all = blocks().length;
		await user.click(screen.getByRole("combobox", { name: "Team" }));
		await user.click(await screen.findByRole("option", { name: "Forge" }));
		await waitFor(() => expect(blocks().length).toBeLessThan(all));
		for (const block of blocks()) expect(block.textContent).toContain("Forge");

		const competition = screen.getByRole("combobox", { name: "Competition" });
		expect(competition.textContent).toContain("Rift League");
		// With every competition, each series says which one it belongs to.
		await user.click(screen.getByRole("radio", { name: "Week" }));
		expect(
			within(cell(7) as HTMLElement).queryByText("Rift League"),
		).toBeNull();
		await user.click(competition);
		await user.click(
			await screen.findByRole("option", { name: "All competitions" }),
		);
		await waitFor(() =>
			expect(
				within(cell(7) as HTMLElement).getAllByText("Rift League").length,
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
		const [open] = within(cell(7) as HTMLElement).getAllByRole("button", {
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
		expect(screen.getByRole("region", { name: "Series MVP" })).toBeTruthy();
		// Read-only: nothing to play again.
		expect(screen.queryByRole("button", { name: /New series/ })).toBeNull();
		await user.click(screen.getByRole("tab", { name: "Map 1" }));
		expect(await screen.findByRole("tabpanel", { name: "Map 1" })).toBeTruthy();
	});

	it("Back returns to the calendar as it was: view, filter and day", async () => {
		const { user } = await openSchedule();
		await user.click(screen.getByRole("button", { name: "Play day" }));
		await waitFor(() =>
			expect(screen.getByText(/^Matchday 1 of \d+$/)).toBeTruthy(),
		);
		await toSchedule(user);
		await user.click(screen.getByRole("combobox", { name: "Team" }));
		await user.click(await screen.findByRole("option", { name: "Forge" }));
		// Today has moved on: choose the day played, then its day view.
		await user.click(cell(7) as HTMLElement);
		await user.click(screen.getByRole("radio", { name: "Day" }));
		const open = await screen.findByRole("button", {
			name: /^Open series: .*Forge/,
		});
		const day = screen.getByRole("heading", { level: 2 }).textContent;
		await user.click(open);
		await screen.findByRole("tab", { name: "Full series" });

		await user.click(screen.getByRole("button", { name: "Back" }));
		await screen.findByRole("button", { name: /^Open series: .*Forge/ });
		expect(
			(screen.getByRole("radio", { name: "Day" }) as HTMLInputElement).checked,
		).toBe(true);
		expect(
			screen.getByRole("combobox", { name: "Team" }).textContent,
		).toContain("Forge");
		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(day);
	});

	it("switching tabs keeps both the stage and the calendar's view and day", async () => {
		const { user } = await openSchedule();
		await user.click(
			await screen.findByRole("button", { name: "Open Rift League" }),
		);
		await user.click(
			await screen.findByRole(
				"combobox",
				{ name: "Stage" },
				{ timeout: 30_000 },
			),
		);
		await user.click(await screen.findByRole("option", { name: "Playoffs" }));
		await user.click(screen.getByRole("radio", { name: "Schedule" }));
		await screen.findByRole("grid");
		await user.click(screen.getByRole("radio", { name: "Month" }));
		await user.click(screen.getByRole("button", { name: "Next" }));
		const month = screen.getByRole("heading", { level: 2 }).textContent;

		await user.click(screen.getByRole("radio", { name: "Standings" }));
		expect(
			(await screen.findByRole("combobox", { name: "Stage" })).textContent,
		).toContain("Playoffs");
		await user.click(screen.getByRole("radio", { name: "Schedule" }));
		await screen.findByRole("grid");
		expect(
			(screen.getByRole("radio", { name: "Month" }) as HTMLInputElement)
				.checked,
		).toBe(true);
		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(month);
	});

	it("the sidebar Calendar shows every competition of the season", async () => {
		await renderWithCore(
			<RouterProvider router={createAppRouter("/calendario")} />,
			hostCore(),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Calendar" }),
		).toBeTruthy();
		await screen.findByRole("grid", undefined, { timeout: 30_000 });
		expect(
			screen.getByRole("combobox", { name: "Competition" }).textContent,
		).toContain("All competitions");
		expect(
			within(cell(7) as HTMLElement).getAllByText("Rift League").length,
		).toBeGreaterThan(0);
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

describe("stage names (#583)", () => {
	it("each series names its split and stage, not the stage id", async () => {
		const api = hostCore();
		const query = api.query.getMockImplementation() as (
			q: unknown,
		) => Promise<{ ok: boolean; view?: unknown }>;
		api.query.mockImplementation((async (q: { kind: string }) => {
			const result = await query(q);
			if (q.kind === "season.overview" && result.ok) {
				const view = result.view as {
					competitions: { stages: { stage: string }[] }[];
				};
				for (const competition of view.competitions)
					for (const stage of competition.stages)
						Object.assign(stage, {
							name:
								stage.stage === "regular"
									? { split: "winter", stage: "groups" }
									: { stage: "playoffs" },
						});
			}
			return result;
		}) as never);
		const { user } = await openSchedule(api);
		await toSchedule(user);
		await user.click(screen.getByRole("radio", { name: "Day" }));
		const list = await screen.findByRole("list", { name: /./ });
		expect(
			within(list).getAllByText("Winter Split, Groups").length,
		).toBeGreaterThan(0);
		expect(list.textContent).not.toContain("Regular");
		expect(list.textContent).not.toContain("·");
	});
});
