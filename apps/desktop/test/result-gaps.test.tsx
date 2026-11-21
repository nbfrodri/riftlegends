import type { SeriesOptions } from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { GapsTable } from "../src/renderer/draft/result-gaps";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

const options = {
	teams: [
		{ id: "forge", name: "Forge" },
		{ id: "shoal", name: "Shoal" },
	],
} as unknown as SeriesOptions;

test("shows gold differences with a sign and rating differences in words", async () => {
	await renderInLocale(
		<GapsTable
			name="Diferencias por rol"
			options={options}
			sideOf={(team) => (team === "forge" ? "blue" : "red")}
			gaps={[
				{ role: "top", team: "forge", points: 4, gold: 300, gap: false },
				{ role: "mid", team: "shoal", points: 18, gold: -1550, gap: true },
				{ role: "bot", team: null, points: 0, gold: 0, gap: false },
			]}
		/>,
		"es-ES",
	);
	const row = (name: string) =>
		within(screen.getByRole("row", { name: new RegExp(name) }));
	expect(row("Top").getByText("+300 oro")).toBeTruthy();
	expect(row("Top").getByText("4 puntos más")).toBeTruthy();
	expect(row("Mid").getByText("−1.550 oro")).toBeTruthy();
	expect(row("ADC").getAllByText("Igualados")).toHaveLength(3);
});
