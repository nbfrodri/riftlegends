import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U8: the team page of the current season, opened from the
// standings and from a played series.

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

async function render(path: string, locale = "en-US") {
	const router = createAppRouter(path);
	await renderWithCore(<RouterProvider router={router} />, hostCore(), locale);
	return { router, user: userEvent.setup() };
}

/** The value of a term of the summary line. */
const term = (label: string) =>
	screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

const heading = (name: string) =>
	screen.findByRole("heading", { level: 1, name }, { timeout: 30_000 });

describe("team page (U8)", () => {
	it("shows the header and the roster with photos before any series", async () => {
		await render("/competicion/equipo/forge");
		await heading("Forge");
		expect(screen.getByText("Seed 1")).toBeTruthy();

		const roster = screen.getByRole("table", { name: "Roster" });
		const rows = within(roster).getAllByRole("row").slice(1);
		expect(rows).toHaveLength(5);
		// Starters in role order, each with a photo (a silhouette here).
		expect(
			within(rows[0] as HTMLElement).getByRole("img", {
				name: "Portrait of Emberjaw",
			}),
		).toBeTruthy();
		expect(within(rows[0] as HTMLElement).getByText("Top")).toBeTruthy();
		// The level is colored and also read out.
		expect(within(rows[0] as HTMLElement).getByText("90")).toBeTruthy();
		expect(within(rows[0] as HTMLElement).getByText("High")).toBeTruthy();

		expect(screen.getByText("Has not played yet")).toBeTruthy();
		expect(screen.queryByRole("list", { name: "Form" })).toBeNull();
		expect(screen.queryByRole("list", { name: "Series" })).toBeNull();
	});

	it("opens the player card from a roster row and gives the focus back", async () => {
		const { user } = await render("/competicion/equipo/forge");
		await heading("Forge");
		const roster = screen.getByRole("table", { name: "Roster" });
		const rows = () => within(roster).getAllByRole("row").slice(1);
		await user.click(rows()[0] as HTMLElement);
		const card = await screen.findByRole("dialog", {
			name: "Player card: Emberjaw",
		});
		expect(within(card).getByText("Top")).toBeTruthy();
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.activeElement).toBe(rows()[0]);

		// Enter opens the card of the focused row, whichever it is.
		(rows()[1] as HTMLElement).focus();
		await user.keyboard("{Enter}");
		const second = await screen.findByRole("dialog", {
			name: /^Player card: /,
		});
		expect(second.getAttribute("aria-label")).not.toBe("Player card: Emberjaw");
	});

	it("speaks Spanish", async () => {
		await render("/competicion/equipo/forge", "es-ES");
		await heading("Forge");
		expect(screen.getByText("Sembrado 1")).toBeTruthy();
		expect(screen.getByRole("table", { name: "Plantilla" })).toBeTruthy();
		expect(screen.getByText("Aún no ha jugado")).toBeTruthy();
	});

	it("opens from the standings and, once played, shows form, streak, series and stats", async () => {
		const { user, router } = await render("/competicion");
		await screen.findByRole(
			"list",
			{ name: "Competitions" },
			{ timeout: 30_000 },
		);
		await user.click(
			within(screen.getByRole("group", { name: "Advance" })).getByRole(
				"button",
				{ name: "Play day" },
			),
		);
		await waitFor(
			() => expect(screen.getByText(/^Matchday 1 of \d+$/)).toBeTruthy(),
			{ timeout: 30_000 },
		);
		await user.click(screen.getByRole("button", { name: "Open Rift League" }));
		const table = await screen.findByRole(
			"table",
			{ name: "Standings: Regular" },
			{ timeout: 30_000 },
		);
		const forge = within(table)
			.getAllByRole("row")
			.find((tr) => within(tr).queryByText("Forge"));
		await user.click(forge as HTMLElement);
		await heading("Forge");
		expect(router.state.location.pathname).toBe("/competicion/equipo/forge");

		// One series played: form of one, a streak of one and the series itself.
		const form = screen.getByRole("list", { name: "Form" });
		const [result] = within(form).getAllByRole("listitem");
		expect(result?.textContent).toMatch(/^(W|L)(Won|Lost) \d–\d against \w+$/);
		const won = result?.textContent?.startsWith("W") ?? false;
		expect(screen.getByText(won ? "1 win" : "1 loss")).toBeTruthy();
		expect(term("Series")).toBe(won ? "1-0" : "0-1");
		expect(term("Average game")).toMatch(/^\d+:\d\d$/);
		expect(screen.queryByText("Has not played yet")).toBeNull();

		// Per-player stats of the season in the roster.
		const roster = screen.getByRole("table", { name: "Roster" });
		const first = within(roster).getAllByRole("row")[1] as HTMLElement;
		expect(within(first).getByText(/^\d+\/\d+\/\d+$/)).toBeTruthy();
		expect(
			within(
				screen.getByRole("list", { name: "Most played champions" }),
			).getAllByRole("listitem").length,
		).toBeGreaterThan(0);

		// A played series opens the read-only series, and Back returns here.
		const series = screen.getByRole("list", { name: "Series" });
		const [entry] = within(series).getAllByRole("button");
		expect(entry?.getAttribute("aria-label")).toMatch(
			/^(Won|Lost) \d–\d against \w+, Rift League, Regular, /,
		);
		await user.click(entry as HTMLElement);
		await screen.findByRole(
			"heading",
			{ level: 1, name: /Forge vs \w+|\w+ vs Forge/ },
			{ timeout: 30_000 },
		);
		// The series view links its teams to their page.
		await user.click(screen.getByRole("button", { name: "Open Forge" }));
		await heading("Forge");
	});

	it("an unknown team says so", async () => {
		await render("/competicion/equipo/nobody");
		expect(
			await screen.findByText("That team does not exist.", undefined, {
				timeout: 30_000,
			}),
		).toBeTruthy();
	});
});
