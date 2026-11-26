import type { StandingsView } from "@rift-legends/contracts";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StandingsTables } from "../src/renderer/competition/standings/standings-tables";
import { createAppRouter } from "../src/renderer/router";
import { renderInLocale } from "./render-in-locale";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U3: league and group standings with the place each team leads to
// and, on the place, why a tie went the way it did.

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

type Row = StandingsView["rows"][number];

const NAMES: Record<string, string> = {
	forge: "Forge",
	shoal: "Shoal",
	breakwater: "Breakwater",
	sunspoke: "Sunspoke",
};
const teamName = (id: string) => NAMES[id] ?? id;

const UNTIED: Row["explanation"] = {
	criterion: "seriesWins",
	tied: [],
	values: {},
};

function row(
	team: string,
	rank: number,
	[seriesWins, seriesLosses, gameWins, gameLosses]: number[],
	explanation: Row["explanation"] = UNTIED,
): Row {
	return {
		team,
		rank,
		seriesWins: seriesWins ?? 0,
		seriesLosses: seriesLosses ?? 0,
		gameWins: gameWins ?? 0,
		gameLosses: gameLosses ?? 0,
		explanation,
	};
}

const headToHead: Row["explanation"] = {
	criterion: "headToHead",
	tied: ["shoal", "breakwater"],
	values: { shoal: 1, breakwater: 0 },
};

const league: StandingsView = {
	rows: [
		row("forge", 1, [3, 0, 6, 1]),
		row("shoal", 2, [1, 2, 3, 4], headToHead),
		row("breakwater", 3, [1, 2, 3, 5], headToHead),
		row("sunspoke", 4, [1, 2, 2, 4], {
			criterion: "gameDiff",
			tied: ["shoal", "breakwater", "sunspoke"],
			values: { shoal: -1, breakwater: -2, sunspoke: -2 },
		}),
	],
	pending: [],
	destinations: [
		{ from: 1, to: 2, competition: "rift-league", stage: "playoffs" },
	],
};

const table = (name: string) => screen.getByRole("table", { name });
const cells = (tr: HTMLElement) =>
	within(tr)
		.getAllByRole("cell")
		.map((cell) => cell.textContent);
const bodyRows = (name: string) =>
	within(table(name)).getAllByRole("row").slice(1);

async function show(view: StandingsView, locale = "en-US") {
	await renderInLocale(
		<StandingsTables standings={view} stage="regular" teamName={teamName} />,
		locale,
	);
}

describe("standings table (U3)", () => {
	test("one row per team with its series, games, difference and destination", async () => {
		await show(league);
		const name = "Standings: Regular";
		expect(
			within(table(name))
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual(["#", "Team", "Series", "Games", "Diff.", "Destination"]);
		const [first, second, third] = bodyRows(name);
		expect(cells(first as HTMLElement)).toEqual([
			"1",
			"Forge",
			"3-0",
			"6-1",
			"+5",
			"Playoffs",
		]);
		expect(cells(second as HTMLElement).slice(2)).toEqual([
			"1-2",
			"3-4",
			"−1",
			"Playoffs",
		]);
		expect(cells(third as HTMLElement).at(-1)).toBe("Eliminated");
	});

	test("a standings table has no search box: it is short enough to read", async () => {
		await show(league);
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(screen.queryByText("4 of 4 teams")).toBeNull();
	});

	test("the place of a tied team explains the tiebreak in words", async () => {
		await show(league);
		const [first, second, , fourth] = bodyRows("Standings: Regular");
		const place = (tr: HTMLElement) =>
			within(tr).getAllByRole("cell")[0]?.querySelector("[data-tooltip]");
		expect(place(first as HTMLElement)).toBeNull();
		expect(
			place(second as HTMLElement)?.getAttribute("data-tooltip-heading"),
		).toBe("Tied with Breakwater");
		expect(place(second as HTMLElement)?.getAttribute("data-tooltip")).toBe(
			"Decided by head-to-head series: Shoal 1, Breakwater 0",
		);
		expect(place(fourth as HTMLElement)?.getAttribute("data-tooltip")).toBe(
			"Decided by game difference: Shoal −1, Breakwater −2, Sunspoke −2",
		);
		// The tooltip is visual: screen readers get the same words in the cell.
		expect(second?.textContent).toContain("Tied with Breakwater");
	});

	test("a tiebreaker series still to play and a draw read in words", async () => {
		await show({
			...league,
			rows: [
				row("forge", 1, [2, 1, 4, 2], {
					criterion: "none",
					tied: ["forge", "shoal"],
					values: {},
				}),
				row("shoal", 2, [2, 1, 4, 2], {
					criterion: "none",
					tied: ["forge", "shoal"],
					values: {},
				}),
				row("breakwater", 3, [1, 2, 2, 4], {
					criterion: "draw",
					tied: ["breakwater", "sunspoke"],
					values: { breakwater: 1, sunspoke: 2 },
				}),
			],
			pending: [{ a: "forge", b: "shoal" }],
		});
		const [first, , third] = bodyRows("Standings: Regular");
		const tip = (tr: HTMLElement) =>
			within(tr)
				.getAllByRole("cell")[0]
				?.querySelector("[data-tooltip]")
				?.getAttribute("data-tooltip");
		expect(tip(first as HTMLElement)).toBe(
			"A tiebreaker series is still to play",
		);
		expect(tip(third as HTMLElement)).toBe("Decided by lot");
	});

	test("before any series nobody is tied and there is no explanation", async () => {
		await show({
			...league,
			rows: league.rows.map((r) => ({
				...r,
				explanation: { criterion: "none", tied: [], values: {} },
			})),
		});
		expect(
			table("Standings: Regular").querySelector("[data-tooltip-heading]"),
		).toBeNull();
	});

	test("a stage that leads nowhere has no destination column", async () => {
		await show({ ...league, destinations: [] });
		expect(
			within(table("Standings: Regular")).queryByRole("columnheader", {
				name: "Destination",
			}),
		).toBeNull();
	});

	test("a team that goes on to two stages names both; an international event by its name", async () => {
		await show({
			...league,
			destinations: [
				{ from: 1, to: 1, competition: "rift-league", stage: "road-to-msi" },
				{ from: 1, to: 4, competition: "rift-league", stage: "rounds-3-4" },
				{ from: 1, to: 1, competition: "msi" },
			],
		});
		const [first, second] = bodyRows("Standings: Regular");
		expect(cells(first as HTMLElement).at(-1)).toBe(
			"Road to msi, Rounds 3-4, and MSI",
		);
		expect(cells(second as HTMLElement).at(-1)).toBe("Rounds 3-4");
	});

	test("a cross-group stage shows one table per group with its own places", async () => {
		const group = (rows: Row[], points: number) => ({
			rows,
			pending: [],
			points,
		});
		await show({
			rows: league.rows,
			pending: [],
			groups: {
				winner: group(
					[row("forge", 1, [2, 0, 4, 0]), row("shoal", 2, [0, 2, 0, 4])],
					3,
				),
				loser: group(
					[
						row("breakwater", 1, [1, 1, 2, 2]),
						row("sunspoke", 2, [1, 1, 2, 3]),
					],
					1,
				),
			},
			destinations: [
				{
					from: 1,
					to: 1,
					competition: "rift-league",
					stage: "playoffs",
					group: "winner",
				},
				{
					from: 1,
					to: 2,
					competition: "rift-league",
					stage: "play-in",
					group: "loser",
				},
			],
		});
		expect(
			screen.queryByRole("table", { name: "Standings: Regular" }),
		).toBeNull();
		expect(screen.getByText("Winning group")).toBeTruthy();
		expect(screen.getByText("3 group points")).toBeTruthy();
		const winning = bodyRows("Winning group");
		expect(winning.map((tr) => cells(tr).at(-1))).toEqual([
			"Playoffs",
			"Eliminated",
		]);
		expect(bodyRows("Losing group").map((tr) => cells(tr).at(-1))).toEqual([
			"Play in",
			"Play in",
		]);
	});

	test("Spanish texts", async () => {
		await show(league, "es-ES");
		const name = "Clasificación: Regular";
		expect(
			within(table(name))
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual(["#", "Equipo", "Series", "Games", "Dif.", "Destino"]);
		const [, second, third] = bodyRows(name);
		expect(cells(third as HTMLElement).at(-1)).toBe("Eliminado");
		expect(
			within(second as HTMLElement)
				.getAllByRole("cell")[0]
				?.querySelector("[data-tooltip]")
				?.getAttribute("data-tooltip"),
		).toBe("Lo decide el enfrentamiento directo: Shoal 1, Breakwater 0");
	});
});

describe("standings in the competition hub (U3)", () => {
	async function openHub(path = "/competicion/rift-league") {
		const router = createAppRouter(path);
		await renderWithCore(<RouterProvider router={router} />, hostCore());
		return { router, user: userEvent.setup() };
	}

	test("opens on the Standings tab with the stage in play", async () => {
		await openHub();
		const regular = await screen.findByRole(
			"table",
			{ name: "Standings: Regular" },
			{ timeout: 30_000 },
		);
		const views = screen.getByRole("radiogroup", { name: "View" });
		expect(within(views).getAllByRole("radio")).toHaveLength(2);
		expect(within(views).getByRole("radio", { name: "Schedule" })).toBeTruthy();
		expect(
			within(views).getByRole("radio", { name: "Standings" }),
		).toHaveProperty("checked", true);
		const rows = within(regular).getAllByRole("row").slice(1);
		expect(rows).toHaveLength(8);
		expect(rows.map((tr) => cells(tr).at(-1))).toEqual([
			...Array(4).fill("Playoffs"),
			...Array(4).fill("Eliminated"),
		]);
	});

	test("the chosen stage lives in the route search, so it comes back", async () => {
		const { router, user } = await openHub();
		await screen.findByRole(
			"table",
			{ name: "Standings: Regular" },
			{ timeout: 30_000 },
		);
		await user.click(screen.getByRole("combobox", { name: "Stage" }));
		await user.click(await screen.findByRole("option", { name: "Playoffs" }));
		await waitFor(() =>
			expect(screen.getByText("This stage has not started yet")).toBeTruthy(),
		);
		expect(router.state.location.search).toMatchObject({ stage: "playoffs" });
		// The schedule tab and back keep the stage.
		await user.click(screen.getByRole("radio", { name: "Schedule" }));
		await user.click(screen.getByRole("radio", { name: "Standings" }));
		expect(
			await screen.findByText("This stage has not started yet"),
		).toBeTruthy();
	});

	test("a link with a stage opens that stage", async () => {
		await openHub("/competicion/rift-league?stage=playoffs");
		expect(
			await screen.findByText(
				"This stage has not started yet",
				{},
				{ timeout: 30_000 },
			),
		).toBeTruthy();
		expect(
			screen.getByRole("combobox", { name: "Stage" }).textContent,
		).toContain("Playoffs");
	});
});
