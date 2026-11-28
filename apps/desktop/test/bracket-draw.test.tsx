import type { BracketView } from "@rift-legends/contracts";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BracketDraw } from "../src/renderer/competition/bracket/bracket-draw";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

type Draw = NonNullable<BracketView["draw"]>;
const draw = (relaxed: Draw["relaxed"] = []): Draw => ({
	tiers: [
		{ team: "a", tier: 1 },
		{ team: "b", tier: 1 },
		{ team: "c", tier: 2 },
		{ team: "d", tier: 3 },
		{ team: "e", tier: 4 },
		{ team: "f", tier: 4 },
	],
	pairs: [
		["c", "d"],
		["a", "e"],
		["b", "f"],
	],
	relaxed,
});

test.each([
	["en-US", "Tiered draw: 1 against 4, 2 against 3"],
	["es-ES", "Sorteo por niveles: 1 contra 4, 2 contra 3"],
])(
	"SO15: %s summarizes the distinct tier matchups in one line",
	async (locale, summary) => {
		await renderInLocale(<BracketDraw draw={draw()} />, locale);
		expect(screen.getByRole("paragraph").textContent).toBe(summary);
		expect(screen.queryByRole("list")).toBeNull();
	},
);

test("SO15: the summary uses the tiers in the draw data", async () => {
	const twoTiers: Draw = {
		...draw(),
		tiers: [
			{ team: "a", tier: 1 },
			{ team: "b", tier: 2 },
		],
		pairs: [["a", "b"]],
	};
	await renderInLocale(<BracketDraw draw={twoTiers} />);
	expect(screen.getByRole("paragraph").textContent).toBe(
		"Tiered draw: 1 against 2",
	);
});

test("SO15: relaxed rules are explained below the summary in order", async () => {
	await renderInLocale(<BracketDraw draw={draw(["regionHalf", "rematch"])} />);
	expect(
		screen.getAllByRole("paragraph").map((note) => note.textContent),
	).toEqual([
		"Tiered draw: 1 against 4, 2 against 3",
		"Same region in one half of the bracket: no other draw was possible",
		"Rematch: no other pairing was possible",
	]);
});
