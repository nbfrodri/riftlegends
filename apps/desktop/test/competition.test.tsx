import { RouterProvider } from "@tanstack/react-router";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U1 and U2: the «Competición» route with the exhibition season.

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

async function open(api = hostCore(), locale = "en-US") {
	await renderWithCore(
		<RouterProvider router={createAppRouter("/competicion")} />,
		api,
		locale,
	);
	await screen.findByRole(
		"list",
		{ name: locale === "es-ES" ? "Competiciones" : "Competitions" },
		{ timeout: 30_000 },
	);
	return { user: userEvent.setup(), api };
}

const card = (name: string) =>
	within(screen.getByRole("list", { name: "Competitions" }))
		.getAllByRole("listitem")
		.find((item) => within(item).queryByRole("heading", { name })) as
		| HTMLElement
		| undefined;
const advance = () => screen.getByRole("group", { name: "Advance" });
const button = (name: string) =>
	within(advance()).getByRole("button", { name });
const batches = (api: ReturnType<typeof hostCore>) =>
	api.send.mock.calls.filter(([c]) => c.kind === "season.playDay");
/** Days the advance has started: a day takes several batches of series. */
const days = (api: ReturnType<typeof hostCore>) =>
	new Set(batches(api).map(([c]) => (c.payload as { day: number }).day)).size;

describe("season overview (U1)", () => {
	it("is a sidebar section that creates the exhibition season on entry", async () => {
		const { api } = await open(undefined, "es-ES");
		expect(
			screen.getByRole("heading", { level: 1, name: "Competición" }),
		).toBeTruthy();
		expect(
			within(screen.getByRole("navigation", { name: "Secciones del club" }))
				.getByRole("button", { name: "Competición" })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(screen.getByText(/^Temporada de exhibición 2026$/)).toBeTruthy();
		const kinds = api.send.mock.calls.map(([c]) => c.kind);
		expect(kinds).toEqual(["season.create"]);
	});

	it("shows a card per competition: not started, live with its leader, then its champion", async () => {
		const { user, api } = await open();
		const league = card("Rift League");
		if (!league) throw new Error("no card");
		expect(within(league).getByText("Not started")).toBeTruthy();
		expect(within(league).getByText(/Starts on day 7/)).toBeTruthy();
		// The first match day is the next one: the card says so in words.
		expect(within(league).getByText("Starts today")).toBeTruthy();
		// No status badges: the state is plain text (user feedback on #582).
		expect(within(league).queryByText("Live")).toBeNull();
		expect(
			within(league).getByRole("img", { name: "Rift League" }),
		).toBeTruthy();

		await user.click(button("Play day"));
		await waitFor(() =>
			expect(
				within(card("Rift League") as HTMLElement).getByText(
					/^Matchday 1 of \d+$/,
				),
			).toBeTruthy(),
		);
		const live = card("Rift League") as HTMLElement;
		expect(within(live).getByText("Leader")).toBeTruthy();
		expect(within(live).getByText("Regular")).toBeTruthy();
		expect(within(live).getByText(/^1-0$/)).toBeTruthy();
		expect(within(live).getByText(/Next day: \d+/)).toBeTruthy();
		expect(days(api)).toBe(1);

		await user.click(button("Whole season"));
		await waitFor(
			() =>
				expect(
					within(card("Rift League") as HTMLElement).getByText("Finished"),
				).toBeTruthy(),
			{ timeout: 50_000 },
		);
		expect(
			within(card("Rift League") as HTMLElement).getByText("Champion"),
		).toBeTruthy();
		expect(screen.getByText("Season over")).toBeTruthy();
	});

	it("opens a competition with a click on its card", async () => {
		const { user } = await open();
		await user.click(
			within(card("Rift League") as HTMLElement).getByRole("button", {
				name: "Open Rift League",
			}),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Rift League" }),
		).toBeTruthy();
		await user.click(
			screen.getByRole("button", { name: "Back to Competition" }),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Competition" }),
		).toBeTruthy();
	});
});

describe("advancing the season (U2)", () => {
	it("disables every advance control while a day is being played and shows the progress", async () => {
		let release: () => void = () => {};
		const api = hostCore(async (command, send) => {
			if (command.kind === "season.playDay")
				await new Promise<void>((resolve) => {
					release = resolve;
				});
			return send();
		});
		const { user } = await open(api);
		for (const name of ["Play day", "Until end of stage", "Whole season"])
			expect(button(name).hasAttribute("disabled")).toBe(false);

		await user.click(button("Whole season"));
		await waitFor(() => expect(days(api)).toBe(1));
		for (const name of ["Play day", "Until end of stage", "Whole season"])
			expect(button(name).hasAttribute("disabled")).toBe(true);
		const progress = screen.getByRole("progressbar", {
			name: "Season progress",
		});
		expect(progress.getAttribute("aria-valuenow")).toBe("0");
		// The bar says how far the run goes.
		expect(screen.getByText("Until the end of the season")).toBeTruthy();

		await waitFor(async () => {
			await act(async () => release());
			expect(days(api)).toBe(2);
		});
		await waitFor(() =>
			expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThan(0),
		);
		// Stop ends the run after the batch being played.
		await user.click(within(advance()).getByRole("button", { name: "Stop" }));
		await waitFor(async () => {
			await act(async () => release());
			expect(button("Play day").hasAttribute("disabled")).toBe(false);
		});
		expect(days(api)).toBe(2);
		expect(
			screen.queryByRole("progressbar", { name: "Season progress" }),
		).toBeNull();
	});

	it("plays a day in batches of series until it closes (#584)", async () => {
		const api = hostCore((command, send) =>
			send(
				command.kind === "season.playDay"
					? {
							...command,
							payload: { ...(command.payload as object), maxSeries: 1 },
						}
					: command,
			),
		);
		const { user } = await open(api);
		await user.click(button("Play day"));
		await waitFor(() =>
			expect(button("Play day").hasAttribute("disabled")).toBe(false),
		);
		// One day takes several batches, and the day shown only moves when it closes.
		expect(batches(api).length).toBeGreaterThan(days(api));
		expect(
			within(card("Rift League") as HTMLElement).queryByText("Starts today"),
		).toBeNull();
	});

	it("«Until end of stage» stops when the current stage is over", async () => {
		const { user } = await open();
		expect(
			within(advance()).getByRole("button", { name: "Until end of stage" }),
		).toBeTruthy();
		await user.click(button("Until end of stage"));
		await waitFor(
			() =>
				expect(
					within(card("Rift League") as HTMLElement).getByText("Playoffs"),
				).toBeTruthy(),
			{ timeout: 50_000 },
		);
		await waitFor(() =>
			expect(button("Play day").hasAttribute("disabled")).toBe(false),
		);
		expect(
			within(card("Rift League") as HTMLElement).getByText("Not started"),
		).toBeTruthy();
	});

	it("stops at the user's series and offers «Play my series»", async () => {
		// The exhibition has no user team: the test gives it one (#482).
		const api = hostCore((command, send) =>
			send(
				command.kind === "season.create"
					? {
							...command,
							payload: { ...(command.payload as object), humanTeam: "forge" },
						}
					: command,
			),
		);
		const { user } = await open(api);
		await user.click(button("Whole season"));
		const play = await within(advance()).findByRole("button", {
			name: "Play my series",
		});
		expect(play).toBeTruthy();
		expect(
			screen.getByText(/^Your series: (Forge vs \w+|\w+ vs Forge)$/),
		).toBeTruthy();
		expect(days(api)).toBe(1);
		for (const name of ["Play day", "Until end of stage", "Whole season"])
			expect(button(name).hasAttribute("disabled")).toBe(true);
	});
});
