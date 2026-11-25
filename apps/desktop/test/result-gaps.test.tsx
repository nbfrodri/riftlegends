import type { SeriesOptions } from "@rift-legends/contracts";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import type { RoleGap } from "../src/renderer/draft/result-data";
import { GapsTable } from "../src/renderer/draft/result-gaps";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftContent: () => "real",
}));

afterEach(cleanup);

const handles: Record<string, string> = {
	"f-top": "Kelpo",
	"s-top": "Slagwick",
	"f-mid": "Brask",
	"s-mid": "Orrin",
	"f-bot": "Tamsel",
	"s-bot": "Vey",
};
const roster = (team: string, prefix: string) => ({
	id: team,
	name: team,
	players: ["top", "mid", "bot"].map((role) => ({
		id: `${prefix}-${role}`,
		handle: handles[`${prefix}-${role}`],
	})),
});
const options = {
	champions: [],
	teams: [roster("forge", "f"), roster("shoal", "s")],
} as unknown as SeriesOptions;
const players = (role: string, forge: number, shoal: number) =>
	[
		{ player: `f-${role}`, team: "forge", champion: "c1", rating: forge },
		{ player: `s-${role}`, team: "shoal", champion: "c2", rating: shoal },
	] as const;

const gaps: RoleGap[] = [
	{
		role: "top",
		team: "forge",
		points: 14.8,
		// Forge leads the rating, Shoal the gold.
		gold: -300,
		gap: false,
		players: players("top", 62.4, 47.6),
	},
	{
		role: "mid",
		team: "shoal",
		points: 18,
		gold: 1550,
		gap: true,
		players: players("mid", 41, 59),
	},
	{
		role: "bot",
		team: null,
		points: 0,
		gold: 0,
		gap: false,
		players: players("bot", 50, 50),
	},
];

/** Renders the table in Spanish and returns a way to find a role's row. */
async function renderGaps(assets = fakeAssets()) {
	await renderInLocale(
		<AssetsProvider api={assets.api}>
			<GapsTable
				name="Diferencias por rol"
				options={options}
				sideOf={(team) => (team === "forge" ? "blue" : "red")}
				gaps={gaps}
			/>
		</AssetsProvider>,
		"es-ES",
	);
	const table = screen.getByRole("table", { name: "Diferencias por rol" });
	return (role: string) => {
		const row = table.querySelector<HTMLElement>(`tr[data-role=${role}]`);
		if (!row) throw new Error(`no row for ${role}`);
		return row;
	};
}

test("uses a cached champion tile when the portrait icon cannot load", async () => {
	const row = await renderGaps(
		fakeAssets({ state: "ready", version: "16.23" }),
	);
	const portrait = within(row("top")).getByRole("img", { name: "c1" });
	await waitFor(() =>
		expect(portrait.querySelector("img")?.getAttribute("src")).toBe(
			"rift-asset://cdragon/champions/c1.png",
		),
	);
	const icon = portrait.querySelector("img");
	if (!icon) throw new Error("Missing champion icon");
	fireEvent.error(icon);
	expect(portrait.querySelector("img")?.getAttribute("src")).toBe(
		"rift-asset://cdragon/tiles/c1.jpg",
	);
});

test("says in words who is ahead in each role and by how much", async () => {
	const row = await renderGaps();
	const top = within(row("top"));
	expect(
		top.getByText("Kelpo, 14,8 puntos por encima de Slagwick"),
	).toBeTruthy();
	expect(top.getByText("Slagwick, 300 de oro más que Kelpo")).toBeTruthy();
	const mid = within(row("mid"));
	expect(mid.getByText("Orrin, 18 puntos por encima de Brask")).toBeTruthy();
	expect(mid.getByText("Orrin, 1.550 de oro más que Brask")).toBeTruthy();
});

test("shows each player's rating and the differences without signs", async () => {
	const row = await renderGaps();
	const top = within(row("top"));
	expect(top.getByText("62,4")).toBeTruthy();
	expect(top.getByText("47,6")).toBeTruthy();
	expect(top.getByText("14,8 pts")).toBeTruthy();
	expect(top.getByText("300 oro")).toBeTruthy();
	for (const role of ["top", "mid", "bot"])
		expect(row(role).textContent).not.toMatch(/[+−-]\s?\d/);
});

test("grows each bar towards the side ahead", async () => {
	const row = await renderGaps();
	const bar = (role: string, metric: string) =>
		row(role).querySelector(`[data-bar=${metric}]`)?.getAttribute("data-side");
	expect(bar("top", "rating")).toBe("blue");
	expect(bar("top", "gold")).toBe("red");
	expect(bar("mid", "rating")).toBe("red");
	expect(bar("mid", "gold")).toBe("red");
});

test("a tie has no bar and reads as even", async () => {
	const row = await renderGaps();
	const bot = row("bot");
	expect(bot.querySelector("[data-bar]")).toBeNull();
	expect(within(bot).getAllByText("Igualados")).toHaveLength(2);
});

test("highlights only the role with the biggest gap", async () => {
	const row = await renderGaps();
	expect(row("mid").getAttribute("data-biggest")).toBe("true");
	expect(row("top").hasAttribute("data-biggest")).toBe(false);
	expect(row("bot").hasAttribute("data-biggest")).toBe(false);
});
