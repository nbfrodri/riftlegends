import type { SeriesOptions, SeriesSummary } from "@rift-legends/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { GameResult } from "../src/renderer/draft/result-data";
import {
	SeriesBanner,
	SeriesReport,
} from "../src/renderer/draft/result-series";
import { renderInLocale } from "./render-in-locale";

const logos: Record<string, string> = {
	forge: "rift-asset://logos/teams/forge.png",
};
const photos: Record<string, string> = {
	"f-mid": "rift-asset://photos/players/f-mid.png",
};
vi.mock("../src/renderer/assets", async (original) => ({
	...(await original<typeof import("../src/renderer/assets")>()),
	useTeamLogoSrc: (id: string) => logos[id],
	usePlayerPhotoSrc: (id: string) => photos[id],
	useAssetSrc: (_source: string, path: string) =>
		`rift-asset://cdragon/${path}`,
}));

const roles = ["top", "jungle", "mid", "bot", "support"] as const;
const handles: Record<string, string> = Object.fromEntries(
	["f", "s"].flatMap((team) =>
		roles.map((role) => [
			`${team}-${role}`,
			`${team === "f" ? "Forge" : "Shoal"}${role}`,
		]),
	),
);
const options = {
	champions: [
		{ id: "ahri", name: "Ahri" },
		{ id: "lux", name: "Lux" },
		{ id: "zed", name: "Zed" },
	],
	teams: [
		{
			id: "forge",
			name: "Forge",
			players: roles.map((role) => ({
				id: `f-${role}`,
				handle: handles[`f-${role}`],
			})),
		},
		{
			id: "shoal",
			name: "Shoal",
			players: roles.map((role) => ({
				id: `s-${role}`,
				handle: handles[`s-${role}`],
			})),
		},
	],
} as unknown as SeriesOptions;
vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftSession: () => ({ options, restart: vi.fn() }),
	useSeriesOptions: () => options,
	useDraftContent: () => "real",
}));

afterEach(cleanup);

/** A game where forge is blue in odd maps; mids play `mid` (forge) and `zed`. */
const game = (n: number, winner: string, mid: string): GameResult => {
	const blue = n % 2 ? "forge" : "shoal";
	const red = blue === "forge" ? "shoal" : "forge";
	const side = (team: string) => (team === blue ? "blue" : "red");
	const lines = [blue, red].flatMap((team) =>
		roles.map((role) => ({
			player: `${team[0]}-${role}`,
			team,
			side: side(team),
			role,
			champion:
				role === "mid" ? (team === "forge" ? mid : "zed") : `${team}-${role}`,
			kills: 0,
			deaths: 0,
			assists: 0,
			gold: 0,
			damage: 0,
			participation: 0,
			vision: 40,
			rating: role === "mid" && team === "forge" && n === 2 ? 90 : 50,
		})),
	);
	return {
		game: n,
		blue,
		red,
		winner,
		duration: 1500 + n * 60,
		lines,
		kills: { blue: 10, red: 5 },
		disputes: [
			{
				type: "match.event",
				game: n,
				minute: 20 + n,
				second: 5,
				kind: "baron",
				side: side(winner),
				zone: "baron-pit",
				kills: [],
				gold: { blue: 0, red: 0 },
				chance: 4000,
				causes: [],
			},
		],
	} as GameResult;
};
// Victory for Forge 2–1; the forge mid plays Ahri twice and Lux once (its best game).
const games = [
	game(1, "forge", "ahri"),
	game(2, "shoal", "lux"),
	game(3, "forge", "ahri"),
];
const summary: SeriesSummary = {
	mvp: {
		player: "f-mid",
		team: "forge",
		champions: ["ahri", "lux", "ahri"],
		rating: 633,
		kills: 9,
		deaths: 2,
		assists: 14,
		participation: 6500,
		games: 3,
	},
	// Forge's mid leads by 20 in every game, whichever side Forge is on.
	lanes: games.map((g) => {
		const sign = g.blue === "forge" ? 1 : -1;
		return {
			game: g.game,
			lines: roles.map((role) => ({
				role,
				rating: role === "mid" ? 20 * sign : 0,
				gold: role === "mid" ? 800 * sign : 0,
				favored: role === "mid" ? (sign > 0 ? "blue" : "red") : null,
				gap: role === "mid",
			})),
		};
	}),
};

test("the series winner shows its logo, and its own crest without one", async () => {
	await renderInLocale(<SeriesBanner games={games} />);
	const banner = screen.getByRole("region", { name: "Series winner" });
	expect(within(banner).getByText("Victory for Forge")).toBeTruthy();
	const logo = banner.querySelector("[data-crest] img");
	expect(logo?.getAttribute("src")).toBe(logos.forge);
	fireEvent.error(logo as Element);
	expect(banner.querySelector("[data-crest] img")).toBeNull();
	expect(banner.querySelector("[data-crest] svg")).toBeTruthy();
	cleanup();
	await renderInLocale(
		<SeriesBanner games={games.map((g) => ({ ...g, winner: "shoal" }))} />,
	);
	const other = screen.getByRole("region", { name: "Series winner" });
	expect(other.querySelector("[data-crest] img")).toBeNull();
	expect(other.querySelector("[data-crest] svg")).toBeTruthy();
});

test("the MVP shows the player's photo and the champion they played most", async () => {
	await renderInLocale(
		<SeriesReport games={games} summary={summary} onOpen={vi.fn()} />,
	);
	const mvp = screen.getByRole("region", { name: "Series MVP" });
	const photo = within(mvp).getByRole("img", { name: "Portrait of Forgemid" });
	expect(photo.getAttribute("src")).toBe(photos["f-mid"]);
	const champion = within(mvp).getByRole("img", { name: "Ahri" });
	expect(champion.querySelector("img")?.getAttribute("src")).toBe(
		"rift-asset://cdragon/tiles/ahri.jpg",
	);
	// Without art, the drawn placeholder keeps the champion's name.
	for (const img of champion.querySelectorAll("img")) fireEvent.error(img);
	expect(within(mvp).getByRole("img", { name: "Ahri" }).textContent).toBe("AH");
});

test("on a tie in games played, the MVP's champion is the one of their best game", async () => {
	const tied = games.slice(0, 2);
	await renderInLocale(
		<SeriesReport
			games={tied}
			summary={{
				...summary,
				mvp: summary.mvp && { ...summary.mvp, champions: ["ahri", "lux"] },
			}}
			onOpen={vi.fn()}
		/>,
	);
	const mvp = screen.getByRole("region", { name: "Series MVP" });
	expect(within(mvp).getByRole("img", { name: "Lux" })).toBeTruthy();
});

test("the recap gives each map's winner with its logo, the running score and the key moment", async () => {
	await renderInLocale(
		<SeriesReport games={games} summary={summary} onOpen={vi.fn()} />,
	);
	const recap = screen.getByRole("table", { name: "Series recap" });
	const rows = within(recap).getAllByRole("row").slice(1);
	expect(rows).toHaveLength(3);
	const [first, second] = rows as [HTMLElement, HTMLElement];
	expect(within(first).getByText("Forge")).toBeTruthy();
	expect(first.querySelector("[data-crest] img")?.getAttribute("src")).toBe(
		logos.forge,
	);
	expect(second.querySelector("[data-crest] svg")).toBeTruthy();
	expect(first.textContent).toContain("1 – 0");
	expect(second.textContent).toContain("1 – 1");
	expect(first.textContent).toContain("21:05");
	expect(first.textContent).toContain("Baron for Forge");
	expect(second.textContent).toContain("Baron for Shoal");
	expect(
		within(first).getByRole("button", { name: "View map 1" }),
	).toBeTruthy();
});

test("each row of the differences by role mirrors the two players of that role, with photo, champion and mean rating", async () => {
	await renderInLocale(
		<SeriesReport games={games} summary={summary} onOpen={vi.fn()} />,
	);
	const table = screen.getByRole("table", { name: "Differences by role" });
	const rows = within(table).getAllByRole("row").slice(1);
	expect(rows).toHaveLength(5);
	rows.forEach((row, i) => {
		const role = roles[i] as string;
		expect(within(row).getByText(handles[`f-${role}`] as string)).toBeTruthy();
		expect(within(row).getByText(handles[`s-${role}`] as string)).toBeTruthy();
		expect(row.textContent).not.toMatch(/\b(Forge|Shoal)\b(?!\w)/);
	});
	const mid = rows[2] as HTMLElement;
	expect(within(mid).getByRole("img", { name: "Ahri" })).toBeTruthy();
	expect(within(mid).getByRole("img", { name: "Zed" })).toBeTruthy();
	// The photo, or the silhouette when there is none.
	expect(
		within(mid).getByRole("img", { name: "Portrait of Forgemid" }).tagName,
	).toBe("IMG");
	expect(
		within(mid).getByRole("img", { name: "Portrait of Shoalmid" }).tagName,
	).toBe("svg");
	// Forge's mid rated 50, 90 and 50.
	expect(within(mid).getByText("63.3")).toBeTruthy();
	expect(within(mid).getByText("50")).toBeTruthy();
	expect(
		within(mid).getByText("Forgemid, 20 points above Shoalmid"),
	).toBeTruthy();
	expect(
		within(mid).getByText("Forgemid, 800 gold more than Shoalmid"),
	).toBeTruthy();
});
