import type { SeriesOptions } from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { GapsTable } from "../src/renderer/draft/result-gaps";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

const options = {
	champions: [],
	teams: [
		{ id: "forge", name: "Forge", players: [] },
		{ id: "shoal", name: "Shoal", players: [] },
	],
} as unknown as SeriesOptions;
const players = (role: string) =>
	[
		{ player: `f-${role}`, team: "forge", champion: "c1" },
		{ player: `s-${role}`, team: "shoal", champion: "c2" },
	] as const;

test("shows gold differences with a sign and rating differences in words", async () => {
	await renderInLocale(
		<GapsTable
			name="Diferencias por rol"
			options={options}
			sideOf={(team) => (team === "forge" ? "blue" : "red")}
			gaps={[
				{
					role: "top",
					team: "forge",
					points: 4,
					gold: 300,
					gap: false,
					players: players("top"),
				},
				{
					role: "mid",
					team: "shoal",
					points: 18,
					gold: -1550,
					gap: true,
					players: players("mid"),
				},
				{
					role: "bot",
					team: null,
					points: 0,
					gold: 0,
					gap: false,
					players: players("bot"),
				},
			]}
		/>,
		"es-ES",
	);
	const row = (name: string) =>
		within(screen.getByRole("row", { name: new RegExp(name) }));
	expect(row("Top").getByText("+300 oro")).toBeTruthy();
	expect(row("Top").getByText("4 puntos más")).toBeTruthy();
	expect(row("Mid").getByText("−1.550 oro")).toBeTruthy();
	expect(row("ADC").getAllByText("Igualados")).toHaveLength(2);
});
