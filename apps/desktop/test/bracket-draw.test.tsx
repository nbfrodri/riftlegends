import type { BracketView } from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BracketDraw } from "../src/renderer/competition/bracket/bracket-draw";
import { renderInLocale } from "./render-in-locale";

// SO15 (plan 12 §6, #628): the hub tells the draw of a bracket, each pairing
// with the tier of its teams and, when a rule was relaxed, why.

afterEach(cleanup);

const names: Record<string, string> = {
	a: "Alpha",
	b: "Bravo",
	c: "Charlie",
	d: "Delta",
};
const team = (id: string) => ({ name: names[id] ?? id });

type Draw = NonNullable<BracketView["draw"]>;
const draw = (relaxed: Draw["relaxed"] = []): Draw => ({
	tiers: [
		{ team: "a", tier: 1 },
		{ team: "b", tier: 1 },
		{ team: "c", tier: 2 },
		{ team: "d", tier: 2 },
	],
	pairs: [
		["a", "d"],
		["b", "c"],
	],
	relaxed,
});
const round = {
	key: "competition.bracket.round.semifinal",
	params: {},
} as const;

test("SO15: each pairing is one sentence with the tier of both teams (EN)", async () => {
	await renderInLocale(<BracketDraw draw={draw()} round={round} team={team} />);
	const region = screen.getByRole("region", { name: "Draw: Semifinal" });
	const lines = within(region).getAllByRole("listitem");
	expect(lines.map((line) => line.textContent)).toEqual([
		"Alpha, tier 1, against Delta, tier 2",
		"Bravo, tier 1, against Charlie, tier 2",
	]);
	expect(region.textContent).not.toContain("·");
	expect(within(region).queryByText(/no other/i)).toBeNull();
});

test("SO15: the same draw in Spanish", async () => {
	await renderInLocale(
		<BracketDraw draw={draw()} round={round} team={team} />,
		"es-ES",
	);
	const region = screen.getByRole("region", { name: "Sorteo: Semifinal" });
	expect(
		within(region)
			.getAllByRole("listitem")
			.map((line) => line.textContent),
	).toEqual([
		"Alpha, nivel 1, contra Delta, nivel 2",
		"Bravo, nivel 1, contra Charlie, nivel 2",
	]);
});

test("SO15: a relaxed rule is told in words, in the order it was relaxed", async () => {
	await renderInLocale(
		<BracketDraw
			draw={draw(["regionHalf", "rematch"])}
			round={round}
			team={team}
		/>,
	);
	const region = screen.getByRole("region", { name: "Draw: Semifinal" });
	expect(
		within(region)
			.getAllByRole("paragraph")
			.map((note) => note.textContent),
	).toEqual([
		"Same region in one half of the bracket: no other draw was possible",
		"Rematch: no other pairing was possible",
	]);
});
