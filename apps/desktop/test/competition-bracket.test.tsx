import { type BracketView, CONTRACT_VERSION } from "@rift-legends/contracts";
import { RouterProvider } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Bracket } from "../src/renderer/competition/bracket/bracket";
import { createAppRouter } from "../src/renderer/router";
import { renderInLocale } from "./render-in-locale";
import { expectWinnerMarker } from "./result-marker";
import { hostCore, renderWithCore } from "./season-core";

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

type Match = BracketView["matches"][number];
type Slot = Match["from"][number];

const seed = (rank: number): Slot => ({ kind: "seed", rank });
const winner = (match: string): Slot => ({ kind: "winner", match });
const loser = (match: string): Slot => ({ kind: "loser", match });

/** A series; `score` (in the order of the teams) marks it as played. */
function match(
	id: string,
	side: Match["side"],
	round: number,
	from: [Slot, Slot],
	teams: [string | null, string | null],
	score?: [number, number],
	status?: Match["status"],
): Match {
	const [teamA, teamB] = teams;
	const won = score ? (score[0] > score[1] ? teamA : teamB) : null;
	return {
		id,
		side,
		round,
		bestOf: 3,
		teamA,
		teamB,
		priority: null,
		status: status ?? (score ? "done" : teamA && teamB ? "ready" : "waiting"),
		winner: won,
		loser: score ? (won === teamA ? teamB : teamA) : null,
		from,
		...(score && { series: `series-${id}`, score }),
	};
}

/** Full names; Delta and Echo also have the short name of the content. */
const teams: Record<string, { name: string; short?: string }> = {
	a: { name: "Alpha" },
	b: { name: "Bravo" },
	c: { name: "Charlie" },
	d: { name: "Delta", short: "DEL" },
	e: { name: "Echo", short: "ECH" },
	f: { name: "Foxtrot" },
};
const team = (id: string) => teams[id] ?? { name: id };

/** Six teams: seeds 1 and 2 have a bye; semifinal 2 is played, the final waits. */
const sixTeams: BracketView = {
	matches: [
		match("U1-1", "upper", 1, [seed(4), seed(5)], ["d", "e"], [2, 0]),
		match("U1-2", "upper", 1, [seed(3), seed(6)], ["c", "f"], [2, 1]),
		match("U2-1", "upper", 2, [seed(1), winner("U1-1")], ["a", "d"]),
		match("U2-2", "upper", 2, [seed(2), winner("U1-2")], ["b", "c"], [2, 1]),
		match("U3-1", "upper", 3, [winner("U2-1"), winner("U2-2")], [null, "b"]),
	],
	champion: null,
	losses: { e: 1, f: 1, c: 1 },
};

/** Four teams, double elimination with a grand final and its reset. */
function doubleElim(final: "pending" | "upper" | "lower"): BracketView {
	const matches = [
		match("U1-1", "upper", 1, [seed(1), seed(4)], ["a", "d"], [2, 0]),
		match("U1-2", "upper", 1, [seed(2), seed(3)], ["b", "c"], [2, 1]),
		match(
			"U2-1",
			"upper",
			2,
			[winner("U1-1"), winner("U1-2")],
			["a", "b"],
			[2, 1],
		),
		match(
			"L1-1",
			"lower",
			1,
			[loser("U1-1"), loser("U1-2")],
			["d", "c"],
			[0, 2],
		),
		match(
			"L2-1",
			"lower",
			2,
			[winner("L1-1"), loser("U2-1")],
			["c", "b"],
			[1, 2],
		),
		match(
			"GF",
			"final",
			1,
			[winner("U2-1"), winner("L2-1")],
			["a", "b"],
			final === "pending" ? undefined : final === "upper" ? [3, 1] : [2, 3],
		),
		match(
			"RS",
			"reset",
			1,
			[winner("U2-1"), winner("L2-1")],
			final === "pending" ? [null, null] : ["a", "b"],
			undefined,
			final === "upper" ? "skipped" : final === "lower" ? "ready" : "waiting",
		),
	];
	return {
		matches,
		champion: final === "upper" ? "a" : null,
		losses: {},
	};
}

let show: (bracket: BracketView) => void = () => {};
let initial: BracketView;

function Harness() {
	const [bracket, setBracket] = useState(initial);
	show = setBracket;
	return <Bracket bracket={bracket} team={team} />;
}

/** Renders the bracket inside the providers and lets the test show a newer one. */
async function renderBracket(first: BracketView) {
	initial = first;
	const view = await renderInLocale(<Harness />);
	return { ...view, show: (bracket: BracketView) => act(() => show(bracket)) };
}

const series = () => screen.getAllByRole("button");
const card = (name: RegExp) => screen.getByRole("button", { name });

describe("U6: bracket", () => {
	test("a card shows each team's logo and short name; the full names are in the tooltip and the reading", async () => {
		const { container } = await renderInLocale(
			<Bracket bracket={sixTeams} team={team} />,
		);
		const quarter = card(/^Quarterfinal 1:/);
		expect(within(quarter).queryByText("Delta")).toBeNull();
		expect(within(quarter).getByText("DEL")).toBeTruthy();
		expect(quarter.getAttribute("aria-label")).toBe(
			"Quarterfinal 1: Delta 2–0 Echo",
		);
		expect(quarter.dataset.tooltip).toBe("Quarterfinal 1: Delta 2–0 Echo");
		// Delta has a downloaded logo; Echo falls back to the own shield.
		const [logo, shield] = [
			...quarter.querySelectorAll("[data-result] > :first-child"),
		];
		expect(logo?.getAttribute("src")).toBe(logos.d);
		expect(shield?.tagName).toBe("svg");
		// Without a short name the full one is shown.
		expect(within(card(/^Quarterfinal 2:/)).getByText("Charlie")).toBeTruthy();
		expect(
			container.querySelector('img[src="rift-asset://logos/teams/d.png"]'),
		).not.toBeNull();
	});

	test("each round is headed by its name and its Bo as a separate muted label, without middle dots", async () => {
		const { container } = await renderInLocale(
			<Bracket bracket={doubleElim("lower")} team={team} />,
		);
		const headers = [...container.querySelectorAll("[data-round-header]")];
		expect(headers.map((h) => h.firstElementChild?.textContent)).toContain(
			"Upper round 1",
		);
		const bo = headers[0]?.querySelector("[data-best-of]");
		expect(bo?.textContent).toBe("Bo3");
		expect(bo?.className).toContain("text-muted");
		const text = [container, ...container.querySelectorAll("[data-tooltip]")]
			.map((node) =>
				node instanceof HTMLElement
					? `${node.textContent} ${node.dataset.tooltip ?? ""} ${node.getAttribute("aria-label") ?? ""}`
					: "",
			)
			.join(" ");
		expect(text).not.toContain("·");
	});

	test("each series shows its teams and score, with the winner marked", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		expect(series()).toHaveLength(5);
		const quarter = card(/Delta 2–0 Echo/);
		expect(
			within(quarter).getByText("DEL").closest("[data-result]"),
		).toHaveProperty("dataset.result", "won");
		expect(
			within(quarter).getByText("ECH").closest("[data-result]"),
		).toHaveProperty("dataset.result", "lost");
	});

	test("the winner's row carries the shared winner marker: bar, full text and score in the action colour", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		expectWinnerMarker(card(/Delta 2–0 Echo/));
	});

	test("with six teams the two best seeds get a bye into the semifinals", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		expect(within(card(/Alpha vs Delta/)).getByText("Bye")).toBeTruthy();
		expect(within(card(/Bravo 2–1 Charlie/)).getByText("Bye")).toBeTruthy();
		expect(screen.getAllByText("Bye")).toHaveLength(2);
	});

	test("a pending slot says where its team will come from", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		const final = card(/^Final:/);
		expect(within(final).getByText("Winner SF1")).toBeTruthy();
		expect(final.getAttribute("aria-label")).toBe(
			"Final: Winner of Semifinal 1 vs Bravo",
		);
		// A truncated name reads whole in the Caja tooltip.
		expect(final.dataset.tooltip).toBe(final.getAttribute("aria-label"));
	});

	test("clicking a played series opens it; one not played yet does nothing", async () => {
		const open = vi.fn();
		await renderInLocale(
			<Bracket bracket={sixTeams} team={team} onOpenSeries={open} />,
		);
		fireEvent.click(card(/Bravo 2–1 Charlie/));
		expect(open).toHaveBeenCalledWith("series-U2-2");
		const waiting = card(/Alpha vs Delta/);
		expect(waiting.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(waiting);
		expect(open).toHaveBeenCalledTimes(1);
	});

	test("connectors join each series to the one its winner goes to", async () => {
		const { container } = await renderInLocale(
			<Bracket bracket={sixTeams} team={team} />,
		);
		const lines = container.querySelectorAll("[data-connector]");
		expect(
			[...lines].map((line) => line.getAttribute("data-connector")),
		).toEqual(["U1-1>U2-1", "U1-2>U2-2", "U2-1>U3-1", "U2-2>U3-1"]);
		expect(
			container
				.querySelector('[data-connector="U2-2>U3-1"]')
				?.getAttribute("data-done"),
		).toBe("true");
	});

	test("the champion is highlighted once known", async () => {
		await renderInLocale(<Bracket bracket={doubleElim("upper")} team={team} />);
		const champion = screen.getByRole("status");
		expect(champion.textContent).toContain("Champion");
		expect(champion.textContent).toContain("Alpha");
	});

	test("double elimination shows the lower bracket and where its teams drop from", async () => {
		await renderInLocale(
			<Bracket bracket={doubleElim("pending")} team={team} />,
		);
		expect(card(/^Lower round 1:/)).toBeTruthy();
		expect(card(/^Lower final: Charlie 1–2 Bravo/)).toBeTruthy();
		expect(card(/^Grand final: Alpha vs Bravo/)).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});

	test("the reset final appears only when it is played", async () => {
		const view = await renderBracket(doubleElim("pending"));
		expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
		view.show(doubleElim("upper"));
		expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
		view.show(doubleElim("lower"));
		expect(card(/^Grand final reset: Alpha vs Bravo/)).toBeTruthy();
	});

	test("without a grand final the upper bracket winner is the champion", async () => {
		const bracket = doubleElim("pending");
		const gsl: BracketView = {
			matches: bracket.matches.filter(
				({ side }) => side !== "final" && side !== "reset",
			),
			champion: "a",
			losses: {},
		};
		await renderInLocale(<Bracket bracket={gsl} team={team} />);
		expect(screen.queryByRole("button", { name: /Grand final/ })).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("Alpha");
	});

	test("Spanish names the rounds and origins", async () => {
		const view = await renderInLocale(
			<Bracket bracket={doubleElim("pending")} team={team} />,
			"es-ES",
		);
		expect(card(/^Final inferior: Charlie 1–2 Bravo/)).toBeTruthy();
		expect(card(/^Gran final: Alpha contra Bravo/)).toBeTruthy();
		view.unmount();
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />, "es-ES");
		expect(within(card(/^Final:/)).getByText("Ganador SF1")).toBeTruthy();
	});
});

describe("U11: keyboard and screen reader", () => {
	test("one series is in the tab order and the arrows move between series", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		const tabbable = () => series().filter((button) => button.tabIndex === 0);
		expect(tabbable()).toHaveLength(1);
		const first = card(/^Quarterfinal 1:/);
		act(() => first.focus());
		fireEvent.keyDown(first, { key: "ArrowDown" });
		expect(document.activeElement).toBe(card(/^Quarterfinal 2:/));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
		expect(document.activeElement).toBe(card(/^Semifinal 2:/));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
		expect(document.activeElement).toBe(card(/^Semifinal 1:/));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
		expect(document.activeElement).toBe(card(/^Final:/));
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(card(/^Semifinal 1:/));
		expect(tabbable()).toEqual([card(/^Semifinal 1:/)]);
	});

	test("the reader hears the round, the teams and the score", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} team={team} />);
		expect(card(/Bravo 2–1 Charlie/).getAttribute("aria-label")).toBe(
			"Semifinal 2: Bravo 2–1 Charlie",
		);
		expect(screen.getByRole("group").getAttribute("aria-label")).toBe(
			"Bracket",
		);
	});

	const played = (): BracketView => ({
		...sixTeams,
		matches: sixTeams.matches.map((m) =>
			m.id === "U2-1"
				? match("U2-1", "upper", 2, m.from, ["a", "d"], [2, 0])
				: m.id === "U3-1"
					? match("U3-1", "upper", 3, m.from, ["a", "b"])
					: m,
		),
	});

	test("a connector that a new result completes is drawn in", async () => {
		const view = await renderBracket(sixTeams);
		const line = () =>
			view.container.querySelector('[data-connector="U2-1>U3-1"]');
		expect(view.container.querySelectorAll(".bracket-draw")).toHaveLength(0);
		view.show(played());
		expect(line()?.classList.contains("bracket-draw")).toBe(true);
		expect(view.container.querySelectorAll(".bracket-draw")).toHaveLength(1);
	});

	test("with reduced motion the connectors do not animate", async () => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		vi.spyOn(media, "matches", "get").mockReturnValue(true);
		vi.spyOn(window, "matchMedia").mockReturnValue(media);
		const view = await renderBracket(sixTeams);
		view.show(played());
		expect(
			view.container
				.querySelector('[data-connector="U2-1>U3-1"]')
				?.getAttribute("data-done"),
		).toBe("true");
		expect(view.container.querySelectorAll(".bracket-draw")).toHaveLength(0);
	});
});

describe("U6: the bracket in the competition hub (#605)", () => {
	/**
	 * The fictional league with only a 4-team playoff of fixed teams, so the
	 * bracket exists from day 0. `created` keeps the session and its position.
	 */
	function playoffCore() {
		const created = { sessionId: 0, position: 0 };
		const api = hostCore(async (command, send) => {
			if (command.kind !== "season.create") return send();
			const payload = command.payload as {
				competitions: { stages: { id: string; window: unknown }[] }[];
				teams: { id: string }[];
			};
			const [league] = payload.competitions;
			const regular = league?.stages[0];
			const result = await send({
				...command,
				payload: {
					...payload,
					competitions: [
						{
							...league,
							stages: [
								{
									id: "playoffs",
									window: regular?.window,
									entrants: {
										kind: "fixed",
										teams: payload.teams.slice(0, 4).map(({ id }) => id),
									},
									play: { type: "singleElim", size: 4, bestOf: [3, 5] },
								},
							],
						},
					],
				},
			});
			if (result.ok)
				Object.assign(created, {
					sessionId: command.sessionId,
					position: result.position,
				});
			return result;
		});
		return { api, created };
	}

	async function openHub(api: ReturnType<typeof hostCore>, path: string) {
		const router = createAppRouter(path);
		await renderWithCore(<RouterProvider router={router} />, api);
		return { router, user: userEvent.setup() };
	}

	const views = () => screen.getByRole("radiogroup", { name: "View" });

	test("a bracket stage adds the Bracket view, which shows its series and lives in the route search", async () => {
		const { api } = playoffCore();
		const { router, user } = await openHub(api, "/competicion/rift-league");
		const bracket = await within(
			await screen.findByRole(
				"radiogroup",
				{ name: "View" },
				{ timeout: 30_000 },
			),
		).findByRole("radio", { name: "Bracket" }, { timeout: 30_000 });
		expect(within(views()).getAllByRole("radio")).toHaveLength(3);
		await user.click(bracket);
		const group = await screen.findByRole("group", { name: "Bracket" });
		expect(
			within(group)
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label")),
		).toEqual([
			expect.stringMatching(/^Semifinal 1: \S.* vs \S/),
			expect.stringMatching(/^Semifinal 2: \S.* vs \S/),
			"Final: Winner of Semifinal 1 vs Winner of Semifinal 2",
		]);
		expect(router.state.location.search).toMatchObject({ view: "bracket" });
	});

	test("a played series of the hub's bracket opens its result", async () => {
		const { api, created } = playoffCore();
		const { router, user } = await openHub(
			api,
			"/competicion/rift-league?view=bracket",
		);
		await screen.findByRole("group", { name: "Bracket" }, { timeout: 30_000 });
		const overview = await api.query({
			v: CONTRACT_VERSION,
			kind: "season.overview",
			sessionId: created.sessionId,
			params: {},
		});
		const { day } = (overview as { view: { day: number } }).view;
		await act(async () => {
			await api.send({
				v: CONTRACT_VERSION,
				kind: "season.playDay",
				sessionId: created.sessionId,
				expectedPosition: created.position,
				payload: { day },
			});
		});
		const [played] = await screen.findAllByRole(
			"button",
			{ name: /^Semifinal \d: \S.* \d–\d \S/ },
			{ timeout: 30_000 },
		);
		await user.click(played as HTMLElement);
		await waitFor(() =>
			expect(router.state.location.pathname).toMatch(
				/^\/competicion\/serie\/.+/,
			),
		);
	});

	test("Back from a series opened in the bracket leaves the bracket view and stage in place (#623)", async () => {
		const { api, created } = playoffCore();
		const { router, user } = await openHub(
			api,
			"/competicion/rift-league?view=bracket&stage=playoffs",
		);
		await screen.findByRole("group", { name: "Bracket" }, { timeout: 30_000 });
		const overview = await api.query({
			v: CONTRACT_VERSION,
			kind: "season.overview",
			sessionId: created.sessionId,
			params: {},
		});
		const { day } = (overview as { view: { day: number } }).view;
		await act(async () => {
			await api.send({
				v: CONTRACT_VERSION,
				kind: "season.playDay",
				sessionId: created.sessionId,
				expectedPosition: created.position,
				payload: { day },
			});
		});
		const [played] = await screen.findAllByRole(
			"button",
			{ name: /^Semifinal \d: \S.* \d–\d \S/ },
			{ timeout: 30_000 },
		);
		await user.click(played as HTMLElement);
		await screen.findByRole("tab", { name: "Full series" });

		await user.click(screen.getByRole("button", { name: "Back" }));
		await screen.findByRole("group", { name: "Bracket" }, { timeout: 30_000 });
		expect(router.state.location.pathname).toBe("/competicion/rift-league");
		expect(router.state.location.search).toMatchObject({
			view: "bracket",
			stage: "playoffs",
		});
		expect(
			within(views()).getByRole("radio", { name: "Bracket" }),
		).toHaveProperty("checked", true);
	});

	test("a league stage has no Bracket view, and a link to it falls back to the standings", async () => {
		await openHub(hostCore(), "/competicion/rift-league?view=bracket");
		await screen.findByRole(
			"table",
			{ name: "Standings: Regular" },
			{ timeout: 30_000 },
		);
		expect(
			within(views()).queryByRole("radio", { name: "Bracket" }),
		).toBeNull();
		expect(
			within(views()).getByRole("radio", { name: "Standings" }),
		).toHaveProperty("checked", true);
	});
});
