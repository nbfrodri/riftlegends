import type { StandingsView } from "@rift-legends/contracts";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SwissRounds } from "../src/renderer/competition/swiss/swiss-rounds";
import { createAppRouter } from "../src/renderer/router";
import { renderInLocale } from "./render-in-locale";
import { hostCore, renderWithCore } from "./season-core";

// Plan 31, U7 and U11 (#487): the Swiss stage in columns by balance, as the
// Worlds broadcast shows it.

/** Downloaded team logos; a team without one shows the own shield. */
const logos: Record<string, string> = {
	d: "rift-asset://logos/teams/d.png",
};
vi.mock("../src/renderer/assets", async (original) => ({
	...(await original<typeof import("../src/renderer/assets")>()),
	useTeamLogoSrc: (id: string) => logos[id],
}));

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

type Swiss = NonNullable<StandingsView["swiss"]>;

const names: Record<string, { name: string; short?: string }> = {
	a: { name: "Alpha" },
	b: { name: "Bravo" },
	c: { name: "Charlie" },
	d: { name: "Delta", short: "DEL" },
};
const team = (id: string) => names[id] ?? { name: id };

/**
 * Four teams to 2 wins or 2 losses. Round 1 had to pair teams of one region;
 * round 3 is a rematch still to play.
 */
const swiss: Swiss = {
	wins: 2,
	losses: 2,
	totalRounds: 3,
	rounds: [
		{
			round: 1,
			relaxed: ["region"],
			series: [
				{
					teams: ["a", "b"],
					record: [0, 0],
					winner: "a",
					score: [1, 0],
					series: "s-1",
				},
				{
					teams: ["c", "d"],
					record: [0, 0],
					winner: "d",
					score: [0, 1],
					series: "s-2",
				},
			],
		},
		{
			round: 2,
			relaxed: [],
			series: [
				{
					teams: ["a", "d"],
					record: [1, 0],
					winner: "a",
					score: [1, 0],
					series: "s-3",
				},
				{
					teams: ["b", "c"],
					record: [0, 1],
					winner: "c",
					score: [0, 1],
					series: "s-4",
				},
			],
		},
		{
			round: 3,
			relaxed: ["rematch"],
			series: [{ teams: ["d", "c"], record: [1, 1] }],
		},
	],
	teams: [
		{ team: "a", wins: 2, losses: 0, status: "qualified" },
		{ team: "b", wins: 0, losses: 2, status: "eliminated" },
		{ team: "c", wins: 1, losses: 1, status: "active" },
		{ team: "d", wins: 1, losses: 1, status: "active" },
	],
};

const show = (onOpenSeries?: (series: string) => void, locale = "en-US") =>
	renderInLocale(
		<SwissRounds swiss={swiss} team={team} onOpenSeries={onOpenSeries} />,
		locale,
	);
const round = (name: string) => screen.getByRole("region", { name });
const card = (name: RegExp) => screen.getByRole("button", { name });

describe("U7: Swiss by balance", () => {
	test("one column per round, its series pooled by balance", async () => {
		await show();
		expect(
			within(screen.getByRole("group", { name: "Swiss" }))
				.getAllByRole("region")
				.map((region) => region.getAttribute("aria-label")),
		).toEqual([
			"Round 1",
			"Round 2",
			"Round 3",
			"Qualified at 2-0",
			"Eliminated at 0-2",
			"Qualified at 2-1",
			"Eliminated at 1-2",
		]);
		const pools = (name: string) =>
			within(round(name))
				.getAllByRole("group")
				.map((group) => group.getAttribute("aria-label"));
		expect(pools("Round 1")).toEqual(["0-0"]);
		expect(pools("Round 2")).toEqual(["1-0", "0-1"]);
		expect(pools("Round 3")).toEqual(["1-1"]);
		expect(
			within(within(round("Round 2")).getByRole("group", { name: "0-1" }))
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label")),
		).toEqual(["Round 2, 0-1: Bravo 0–1 Charlie"]);
	});

	test("a series shows each team's logo and short name, the winner marked", async () => {
		await show();
		const played = card(/^Round 2, 1-0:/);
		expect(within(played).getByText("DEL")).toBeTruthy();
		expect(within(played).queryByText("Delta")).toBeNull();
		const [alpha, delta] = [...played.querySelectorAll("[data-result]")];
		expect(alpha?.getAttribute("data-result")).toBe("won");
		expect(delta?.getAttribute("data-result")).toBe("lost");
		// Delta has a downloaded logo; Alpha falls back to the own shield.
		expect(alpha?.firstElementChild?.tagName).toBe("svg");
		expect(delta?.firstElementChild?.getAttribute("src")).toBe(logos.d);
		expect(played.dataset.tooltip).toBe(played.getAttribute("aria-label"));
	});

	test("teams that qualify or are eliminated appear after the round that decides it, under their record", async () => {
		const { container } = await show();
		const box = (name: string) => screen.getByRole("region", { name });
		expect(within(box("Qualified at 2-0")).getByText("Alpha")).toBeTruthy();
		expect(within(box("Eliminated at 0-2")).getByText("Bravo")).toBeTruthy();
		// The record heads the box; the state is its title and place, not a badge.
		expect(within(box("Qualified at 2-0")).getByText("Qualified")).toBeTruthy();
		expect(within(box("Qualified at 2-0")).getByText("2-0")).toBeTruthy();
		// The qualified sit above the round's pools and the eliminated below.
		const top = (name: string) => Number.parseFloat(box(name).style.top);
		const pool = within(round("Round 3")).getByRole("group", { name: "1-1" });
		expect(top("Qualified at 2-0")).toBeLessThan(
			Number.parseFloat(pool.style.top),
		);
		expect(top("Eliminated at 0-2")).toBeGreaterThan(
			Number.parseFloat(pool.style.top),
		);
		// Charlie and Delta still play: the last boxes wait for them.
		expect(
			within(box("Qualified at 2-1")).getByText("To be decided"),
		).toBeTruthy();
		expect(
			within(box("Eliminated at 1-2")).getByText("To be decided"),
		).toBeTruthy();
		expect(container.textContent).not.toMatch(/[·•|]/);
	});

	test("a round that relaxed its constraints says so in words", async () => {
		await show();
		expect(
			within(round("Round 1")).getByText(
				"Same-region pairing: no other was possible",
			),
		).toBeTruthy();
		expect(
			within(round("Round 3")).getByText(
				"Rematch: no other pairing was possible",
			),
		).toBeTruthy();
		expect(within(round("Round 2")).queryByText(/possible/)).toBeNull();
	});

	test("clicking a played series opens it; one not played yet does nothing", async () => {
		const open = vi.fn();
		await show(open);
		fireEvent.click(card(/^Round 1, 0-0: Charlie 0–1 Delta/));
		expect(open).toHaveBeenCalledWith("s-2");
		const waiting = card(/^Round 3, 1-1: Delta vs Charlie/);
		expect(waiting.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(waiting);
		expect(open).toHaveBeenCalledTimes(1);
	});

	test("rounds not paired yet show their balances, waiting to be paired", async () => {
		const [first] = swiss.rounds;
		await renderInLocale(
			<SwissRounds
				swiss={{
					...swiss,
					rounds: first ? [first] : [],
					teams: swiss.teams.map((row) => ({
						...row,
						wins: row.team === "a" || row.team === "d" ? 1 : 0,
						losses: row.team === "a" || row.team === "d" ? 0 : 1,
						status: "active",
					})),
				}}
				team={team}
			/>,
		);
		const pool = (round: string, balance: string) =>
			within(screen.getByRole("region", { name: round })).getByRole("group", {
				name: balance,
			});
		expect(
			within(pool("Round 2", "1-0")).getByText("To be paired"),
		).toBeTruthy();
		expect(
			within(pool("Round 2", "0-1")).getByText("To be paired"),
		).toBeTruthy();
		expect(
			within(pool("Round 3", "1-1")).getByText("To be paired"),
		).toBeTruthy();
		// Nothing to open or focus there.
		expect(within(round("Round 2")).queryAllByRole("button")).toHaveLength(0);
		expect(
			within(
				screen.getByRole("region", { name: "Qualified at 2-0" }),
			).getByText("To be decided"),
		).toBeTruthy();
	});

	test("lines join each balance to the two it leads to in the next column", async () => {
		const { container } = await show();
		const lines = [...container.querySelectorAll("[data-flow]")].map((path) =>
			path.getAttribute("data-flow"),
		);
		expect(lines.sort()).toEqual(
			[
				"1:0-0>2:1-0",
				"1:0-0>2:0-1",
				"2:1-0>3:qualified",
				"2:1-0>3:1-1",
				"2:0-1>3:1-1",
				"2:0-1>3:eliminated",
				"3:1-1>4:qualified",
				"3:1-1>4:eliminated",
			].sort(),
		);
	});

	test("a pool's winners leave from the top half and its losers from the bottom half, on elbow lines told apart by style", async () => {
		const { container } = await show();
		const path = (id: string) =>
			container.querySelector(`[data-flow="${id}"]`) as SVGPathElement;
		const points = (id: string) =>
			[...(path(id).getAttribute("d") ?? "").matchAll(/-?[\d.]+/g)].map(Number);
		// Only horizontal and vertical segments, as in the bracket.
		for (const line of container.querySelectorAll("[data-flow]"))
			expect(line.getAttribute("d")).toMatch(
				/^M-?[\d.]+ -?[\d.]+( [HV]-?[\d.]+)+$/,
			);
		const pool = within(round("Round 1")).getByRole("group", { name: "0-0" });
		const top = Number.parseFloat(pool.style.top);
		const middle = top + Number.parseFloat(pool.style.height) / 2;
		const [, winY] = points("1:0-0>2:1-0");
		const [, lossY] = points("1:0-0>2:0-1");
		expect(winY).toBeLessThan(middle);
		expect(lossY).toBeGreaterThan(middle);
		expect(path("1:0-0>2:1-0").dataset.result).toBe("win");
		expect(path("1:0-0>2:0-1").dataset.result).toBe("loss");
		expect(path("1:0-0>2:1-0").getAttribute("stroke-dasharray")).toBeNull();
		expect(path("1:0-0>2:0-1").getAttribute("stroke-dasharray")).not.toBeNull();
		// Two pools that feed one pool enter it at the same point.
		const entry = (id: string) => {
			const d = path(id).getAttribute("d") ?? "";
			const y = [...d.matchAll(/V(-?[\d.]+)/g)].at(-1)?.[1];
			return [Number(d.match(/H(-?[\d.]+)$/)?.[1]), Number(y)];
		};
		expect(entry("2:1-0>3:1-1")).toEqual(entry("2:0-1>3:1-1"));
		// Lines go block to block: into the target's header, never at a series.
		const block = within(round("Round 3")).getByRole("group", { name: "1-1" });
		const blockTop = Number.parseFloat(block.style.top);
		const [, entryY] = entry("2:1-0>3:1-1");
		expect(entryY).toBeGreaterThan(blockTop);
		expect(entryY).toBeLessThan(blockTop + 24);
		const box = screen.getByRole("region", { name: "Qualified at 2-0" });
		const [, boxEntry] = entry("2:1-0>3:qualified");
		expect(boxEntry).toBeGreaterThan(Number.parseFloat(box.style.top));
		expect(boxEntry).toBeLessThan(Number.parseFloat(box.style.top) + 24);
	});

	test("Spanish names the rounds, the lists and the notices", async () => {
		await show(undefined, "es-ES");
		expect(card(/^Ronda 3, 1-1: Delta contra Charlie$/)).toBeTruthy();
		expect(
			screen.getByRole("region", { name: "Clasificados con 2-0" }),
		).toBeTruthy();
		expect(
			screen.getByRole("region", { name: "Eliminados con 0-2" }),
		).toBeTruthy();
		expect(
			screen.getByText("Cruce de la misma región: no había otro posible"),
		).toBeTruthy();
		expect(
			screen.getByText("Revancha: no había otro cruce posible"),
		).toBeTruthy();
	});
});

describe("U11: Swiss keyboard and screen reader", () => {
	test("one series is in the tab order and the arrows move between series", async () => {
		await show();
		const tabbable = () =>
			screen.getAllByRole("button").filter((button) => button.tabIndex === 0);
		expect(tabbable()).toEqual([card(/^Round 1, 0-0: Alpha/)]);
		card(/^Round 1, 0-0: Alpha/).focus();
		const press = (key: string) =>
			fireEvent.keyDown(document.activeElement as Element, { key });
		press("ArrowDown");
		expect(document.activeElement).toBe(card(/^Round 1, 0-0: Charlie/));
		press("ArrowRight");
		expect(document.activeElement).toBe(card(/^Round 2, 0-1:/));
		press("ArrowRight");
		// Round 3 has one series: the nearest one.
		expect(document.activeElement).toBe(card(/^Round 3, 1-1:/));
		press("ArrowRight");
		expect(document.activeElement).toBe(card(/^Round 3, 1-1:/));
		press("ArrowLeft");
		expect(document.activeElement).toBe(card(/^Round 2, 1-0:/));
		press("ArrowUp");
		expect(document.activeElement).toBe(card(/^Round 2, 1-0:/));
		expect(tabbable()).toEqual([card(/^Round 2, 1-0:/)]);
	});

	test("the reader hears the round, the balance, the teams and the score", async () => {
		await show();
		expect(card(/Alpha 1–0 Bravo/).getAttribute("aria-label")).toBe(
			"Round 1, 0-0: Alpha 1–0 Bravo",
		);
	});
});

describe("U7: the Swiss stage in the competition hub", () => {
	test("a Swiss stage adds the Bracket view, with round 1 at 0-0", async () => {
		const api = hostCore((command, send) => {
			if (command.kind !== "season.create") return send();
			const payload = command.payload as {
				competitions: { stages: { window: unknown }[] }[];
				teams: { id: string }[];
			};
			const [league] = payload.competitions;
			return send({
				...command,
				payload: {
					...payload,
					competitions: [
						{
							...league,
							stages: [
								{
									id: "swiss",
									window: league?.stages[0]?.window,
									entrants: {
										kind: "fixed",
										teams: payload.teams.map(({ id }) => id),
									},
									play: {
										type: "swiss",
										size: payload.teams.length,
										wins: 2,
										losses: 2,
										bestOf: 1,
										decisiveBestOf: 1,
										round1: "pots",
										avoid: ["region"],
									},
								},
							],
						},
					],
				},
			});
		});
		const router = createAppRouter("/competicion/rift-league");
		await renderWithCore(<RouterProvider router={router} />, api);
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole(
				"radio",
				{ name: "Bracket" },
				{ timeout: 30_000 },
			),
		);
		const first = await screen.findByRole(
			"region",
			{ name: "Round 1" },
			{ timeout: 30_000 },
		);
		expect(
			within(within(first).getByRole("group", { name: "0-0" })).getAllByRole(
				"button",
			),
		).toHaveLength(4);
		expect(
			within(first).getByText("Same-region pairing: no other was possible"),
		).toBeTruthy();
	});
});
