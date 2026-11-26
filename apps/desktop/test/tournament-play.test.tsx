import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { hostCore, renderWithCore } from "./season-core";

// U10 (plan 31): a tournament is played from its hub; the user's series goes
// through the draft flow, and the end shows the champion.

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

async function choose(user: User, combobox: HTMLElement, option: string) {
	await user.click(combobox);
	await user.click(await screen.findByRole("option", { name: option }));
}

/** A custom single elimination of the four best teams, mine the best one or none. */
async function startTournament(watch: boolean) {
	const api = hostCore();
	await renderWithCore(
		<RouterProvider router={createAppRouter("/torneo")} />,
		api,
	);
	const user = userEvent.setup();
	const first = await screen.findByRole(
		"group",
		{ name: "Stage 1" },
		{ timeout: 10_000 },
	);
	await choose(
		user,
		within(first).getByRole("combobox", { name: "Block" }),
		"Single elimination",
	);
	for (const n of [8, 7, 6, 5])
		await user.click(
			await screen.findByRole("button", { name: `Remove team ${n}` }),
		);
	const best = screen.getByRole("combobox", { name: "Team 1" }).textContent;
	if (!best) throw new Error("no first team");
	if (!watch)
		await choose(user, screen.getByRole("combobox", { name: "My team" }), best);
	const start = screen.getByRole("button", { name: "Start tournament" });
	await waitFor(() => expect(start.hasAttribute("disabled")).toBe(false));
	await user.click(start);
	await screen.findByRole(
		"heading",
		{ level: 1, name: "Custom tournament" },
		{ timeout: 10_000 },
	);
	return { api, user, best };
}

const advance = () => screen.getByRole("group", { name: "Advance" });

// Each test plays several days of a tournament against the real core host.
describe("U10: play a tournament", { timeout: 30_000 }, () => {
	test("the hub plays the AI's series and stops at mine, which opens the draft flow", async () => {
		const { api, user, best } = await startTournament(false);
		expect(screen.getByText(`You play with ${best}.`)).toBeTruthy();
		expect(screen.getByRole("radio", { name: "Standings" })).toBeTruthy();
		// The knockout of a custom tournament has a catalog name, not its id.
		expect(
			(await screen.findByRole("combobox", { name: "Stage" })).textContent,
		).toMatch(/^Playoffs/);
		await user.click(
			within(advance()).getByRole("button", { name: "Play day" }),
		);
		const mine = await within(advance()).findByRole("button", {
			name: "Play my series",
		});
		expect(within(advance()).getByText(/^Your series: /).textContent).toContain(
			best,
		);
		await waitFor(() => expect(mine.hasAttribute("disabled")).toBe(false));
		await user.click(mine);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Side and order" }),
		).toBeTruthy();
		expect(
			screen.getByRole("navigation", { name: "You are here" }).textContent,
		).toContain("Tournament");
		const played = api.send.mock.calls
			.map(([command]) => command)
			.find(({ kind }) => kind === "season.playSeries");
		expect(played?.payload).toMatchObject({ timer: false });
	});

	test("watching only, the whole tournament ends on the champion, then the hub or a new one", async () => {
		const { user } = await startTournament(true);
		expect(
			screen.getByText("You follow the tournament as a spectator."),
		).toBeTruthy();
		await user.click(
			within(advance()).getByRole("button", { name: "Whole tournament" }),
		);
		const champion = await screen.findByRole(
			"region",
			{ name: /./ },
			{ timeout: 10_000 },
		);
		expect(
			within(champion).getByText("Champion of Custom tournament"),
		).toBeTruthy();
		expect(within(champion).getByText(/^Final: /)).toBeTruthy();
		const name = within(champion).getByRole("heading", {
			level: 2,
		}).textContent;
		await user.click(
			within(champion).getByRole("button", { name: "See the tournament" }),
		);
		expect(
			await within(advance()).findByRole("button", { name: "New tournament" }),
		).toBeTruthy();
		expect(screen.getByText(`${name} is the champion.`)).toBeTruthy();
		await user.click(
			within(advance()).getByRole("button", { name: "New tournament" }),
		);
		expect(
			await screen.findByRole("button", { name: "Start tournament" }),
		).toBeTruthy();
	});
});
