import type { BracketView } from "@rift-legends/contracts";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Bracket } from "../src/renderer/competition/bracket/bracket";
import { renderInLocale } from "./render-in-locale";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
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

const names: Record<string, string> = {
	a: "Alpha",
	b: "Bravo",
	c: "Charlie",
	d: "Delta",
	e: "Echo",
	f: "Foxtrot",
};
const teamName = (id: string) => names[id] ?? id;

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
	return <Bracket bracket={bracket} teamName={teamName} />;
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
	test("each series shows its teams and score, with the winner marked", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} teamName={teamName} />);
		expect(series()).toHaveLength(5);
		const quarter = card(/Delta 2–0 Echo/);
		expect(
			within(quarter).getByText("Delta").closest("[data-result]"),
		).toHaveProperty("dataset.result", "won");
		expect(
			within(quarter).getByText("Echo").closest("[data-result]"),
		).toHaveProperty("dataset.result", "lost");
	});

	test("with six teams the two best seeds get a bye into the semifinals", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} teamName={teamName} />);
		expect(within(card(/Alpha vs Delta/)).getByText("Bye")).toBeTruthy();
		expect(within(card(/Bravo 2–1 Charlie/)).getByText("Bye")).toBeTruthy();
		expect(screen.getAllByText("Bye")).toHaveLength(2);
	});

	test("a pending slot says where its team will come from", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} teamName={teamName} />);
		const final = card(/^Final:/);
		expect(within(final).getByText("Winner of Semifinal 1")).toBeTruthy();
		expect(final.getAttribute("aria-label")).toBe(
			"Final: Winner of Semifinal 1 vs Bravo",
		);
		// A truncated name reads whole in the Caja tooltip.
		expect(final.dataset.tooltip).toBe(final.getAttribute("aria-label"));
	});

	test("clicking a played series opens it; one not played yet does nothing", async () => {
		const open = vi.fn();
		await renderInLocale(
			<Bracket bracket={sixTeams} teamName={teamName} onOpenSeries={open} />,
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
			<Bracket bracket={sixTeams} teamName={teamName} />,
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
		await renderInLocale(
			<Bracket bracket={doubleElim("upper")} teamName={teamName} />,
		);
		const champion = screen.getByRole("status");
		expect(champion.textContent).toContain("Champion");
		expect(champion.textContent).toContain("Alpha");
	});

	test("double elimination shows the lower bracket and where its teams drop from", async () => {
		await renderInLocale(
			<Bracket bracket={doubleElim("pending")} teamName={teamName} />,
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
		await renderInLocale(<Bracket bracket={gsl} teamName={teamName} />);
		expect(screen.queryByRole("button", { name: /Grand final/ })).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("Alpha");
	});

	test("Spanish names the rounds and origins", async () => {
		await renderInLocale(
			<Bracket bracket={doubleElim("pending")} teamName={teamName} />,
			"es-ES",
		);
		expect(card(/^Final inferior: Charlie 1–2 Bravo/)).toBeTruthy();
		expect(card(/^Gran final: Alpha contra Bravo/)).toBeTruthy();
	});
});

describe("U11: keyboard and screen reader", () => {
	test("one series is in the tab order and the arrows move between series", async () => {
		await renderInLocale(<Bracket bracket={sixTeams} teamName={teamName} />);
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
		await renderInLocale(<Bracket bracket={sixTeams} teamName={teamName} />);
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
