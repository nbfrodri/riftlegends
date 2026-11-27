import { loadRealContent } from "@rift-legends/core";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets, testCatalog } from "./fake-assets";

// The real content takes a while to load on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

const real = loadRealContent();
const players = real.draft.players;
const teams = real.match.teams;

/** Opens the database with the real content, as the app does. */
async function open(locale = "en-US", photos: Record<string, string> = {}) {
	const ids = real.draft.champions.map((c) => c.id);
	const assets = fakeAssets(
		{ state: "ready", version: "16.23" },
		testCatalog(ids),
	);
	assets.api.playerPhotos.mockResolvedValue(photos);
	await renderWithDraftCore(
		<RouterProvider router={createAppRouter("/base-de-datos")} />,
		locale,
		undefined,
		undefined,
		{ assets: assets.api, content: "real" },
	);
	await screen.findByRole("table", {}, { timeout: 20_000 });
	return userEvent.setup();
}

const status = () =>
	within(screen.getByRole("region", { name: "Players" })).getByRole("status")
		.textContent;
const bodyRows = () =>
	within(screen.getAllByRole("rowgroup")[1] as HTMLElement).getAllByRole("row");
const tab = (name: string) =>
	within(screen.getByRole("radiogroup", { name: "Section" })).getByRole(
		"radio",
		{ name },
	);

it("is a sidebar section with its own heading", async () => {
	await open("es-ES");
	expect(
		screen.getByRole("heading", { level: 1, name: "Base de datos" }),
	).toBeTruthy();
	expect(
		within(screen.getByRole("navigation", { name: "Secciones del club" }))
			.getByRole("button", { name: "Base de datos" })
			.getAttribute("aria-current"),
	).toBe("page");
});

it("lists every player of the real content with its columns", async () => {
	await open();
	expect(
		screen.getAllByRole("columnheader").map((header) => header.textContent),
	).toEqual([
		"Player",
		"Nationality",
		"Age",
		"Role",
		"Team",
		"League",
		"Rating",
	]);
	expect(status()).toBe(`${players.length} of ${players.length} players`);
	expect(screen.getByText("Faker").closest("td")).toBeTruthy();
});

it("filters with the side panel and sorts by a column", async () => {
	const user = await open();
	const panel = within(screen.getByRole("complementary", { name: "Filters" }));
	await user.click(panel.getByRole("button", { name: "Mid" }));
	const mids = players.filter((p) => p.role === "mid").length;
	expect(status()).toBe(`${mids} of ${players.length} players`);
	await user.click(panel.getByRole("button", { name: "Top rated" }));
	const topMids = players.filter((p) => p.role === "mid" && p.level >= 80);
	expect(status()).toBe(`${topMids.length} of ${players.length} players`);
	expect(
		screen.getByRole("list", { name: "Active filters" }).textContent,
	).toContain("Role: Mid");
	await user.click(panel.getByRole("button", { name: "Clear filters" }));
	expect(status()).toBe(`${players.length} of ${players.length} players`);

	const rating = screen.getByRole("columnheader", { name: "Rating" });
	await user.click(within(rating).getByRole("button"));
	await user.click(within(rating).getByRole("button"));
	const best = Math.max(...players.map((p) => p.level));
	expect(
		within(bodyRows()[0] as HTMLElement).getAllByRole("cell")[6]?.textContent,
	).toMatch(new RegExp(`^${best}`));
});

it("filters by league, team and nationality", async () => {
	const user = await open();
	const panel = within(screen.getByRole("complementary", { name: "Filters" }));
	await user.click(panel.getByRole("combobox", { name: "League" }));
	await user.click(await screen.findByRole("option", { name: "LEC" }));
	const lec = new Set(teams.filter((t) => t.league === "LEC").map((t) => t.id));
	const inLec = players.filter((p) => lec.has(p.team)).length;
	expect(status()).toBe(`${inLec} of ${players.length} players`);
	await user.click(panel.getByRole("combobox", { name: "Nationality" }));
	await user.click(await screen.findByRole("option", { name: "Denmark" }));
	const danes = players.filter(
		(p) => lec.has(p.team) && p.nationality === "DK",
	).length;
	expect(status()).toBe(`${danes} of ${players.length} players`);
});

it("opens the player card from a row and returns focus on Escape", async () => {
	const user = await open();
	const row = screen
		.getAllByRole("row")
		.find((r) => within(r).queryByText("Faker")) as HTMLElement;
	await user.click(row);
	const card = within(
		screen.getByRole("dialog", { name: "Player card: Faker" }),
	);
	expect(card.getByRole("heading", { name: "Lane" })).toBeTruthy();
	expect(card.getByRole("region", { name: "Champion pool" })).toBeTruthy();
	expect(card.getByText("T1")).toBeTruthy();
	await user.keyboard("{Escape}");
	expect(
		screen.queryByRole("dialog", { name: "Player card: Faker" }),
	).toBeNull();
	expect(document.activeElement).toBe(row);
});

it("shows every team with league, seed, coach and roster", async () => {
	const user = await open();
	await user.click(tab("Teams"));
	const list = within(screen.getByRole("list", { name: "All teams" }));
	expect(list.getAllByRole("listitem", { name: /.+/ })).toHaveLength(
		teams.length,
	);
	const t1 = within(list.getByRole("listitem", { name: "T1" }));
	const seed = teams.find((t) => t.id === "T1")?.seed;
	expect(t1.getByText(`LCK, seed ${seed}`)).toBeTruthy();
	expect(t1.getByText(/Coach: /)).toBeTruthy();
	await user.click(t1.getByRole("button", { name: /Faker/ }));
	expect(
		screen.getByRole("dialog", { name: "Player card: Faker" }),
	).toBeTruthy();
});

it("shows every coach with team, league, draft style and level", async () => {
	const user = await open();
	await user.click(tab("Coaches"));
	expect(
		screen.getAllByRole("columnheader").map((header) => header.textContent),
	).toEqual(["Coach", "Team", "League", "Draft style", "Level"]);
	const table = within(screen.getByRole("region", { name: "Coaches" }));
	expect(table.getByRole("status").textContent).toBe(
		`${teams.length} of ${teams.length} coaches`,
	);
	const geng = teams.find((t) => t.id === "Gen.G");
	const row = screen
		.getAllByRole("row")
		.find((r) => within(r).queryByText("Gen.G")) as HTMLElement;
	expect(within(row).getByText(geng?.coach.name ?? "")).toBeTruthy();
	expect(within(row).getByText("Balanced")).toBeTruthy();
});

it("shows the official photos in the rows and the card, a silhouette without one", async () => {
	const photo = "rift-asset://photos/faker.png";
	const user = await open("en-US", { Faker: photo });
	const row = screen
		.getAllByRole("row")
		.find((r) => within(r).queryByText("Faker")) as HTMLElement;
	expect(
		within(row)
			.getByRole("img", { name: "Portrait of Faker" })
			.getAttribute("src"),
	).toBe(photo);
	const other = screen
		.getAllByRole("row")
		.find((r) => within(r).queryByText("Chovy")) as HTMLElement;
	expect(
		within(other).getByRole("img", { name: "Portrait of Chovy" }).tagName,
	).toBe("svg");
	await user.click(row);
	const card = within(
		screen.getByRole("dialog", { name: "Player card: Faker" }),
	);
	expect(
		card.getByRole("img", { name: "Portrait of Faker" }).getAttribute("src"),
	).toBe(photo);
});

const born = players.find((p) => p.birthDate);
const unknown = players.find((p) => !p.birthDate);
const rowOf = (handle: string) =>
	screen
		.getAllByRole("row")
		.find((r) => within(r).queryByText(handle)) as HTMLElement;

it("shows each age on the game date and a dash with a hint when unknown", async () => {
	await open();
	// The game date is 18 Jun 2027 (the date the sidebar shows).
	expect(within(rowOf("Faker")).getAllByRole("cell")[2]?.textContent).toBe(
		"31",
	);
	if (!unknown) throw new Error("expected a player without a birth date");
	const cell = within(rowOf(unknown.handle)).getAllByRole("cell")[2];
	expect(cell?.textContent).toBe("—");
	expect(
		within(cell as HTMLElement).getByRole("img", { name: "Age unknown" }),
	).toBeTruthy();
});

it("sorts the list by age, with unknown ages after the oldest", async () => {
	const user = await open();
	const header = screen.getByRole("columnheader", { name: "Age" });
	await user.click(within(header).getByRole("button"));
	const ages = bodyRows().map(
		(row) => within(row).getAllByRole("cell")[2]?.textContent,
	);
	const known = ages.filter((age) => age !== "—").map(Number);
	expect(known).toEqual([...known].sort((a, b) => a - b));
	expect(ages[0]).not.toBe("—");
	await user.click(within(header).getByRole("button"));
	const first = within(bodyRows()[0] as HTMLElement).getAllByRole("cell")[2];
	expect(first?.textContent).toBe("—");
});

it("shows the age in the player card, in Spanish too", async () => {
	const user = await open("es-ES");
	expect(born).toBeTruthy();
	await user.click(rowOf("Faker"));
	const card = within(
		screen.getByRole("dialog", { name: "Ficha de jugador: Faker" }),
	);
	expect(card.getByText("31 años")).toBeTruthy();
});

// Every column declares its width, so the space left over is spread over
// all of them instead of pushing League and Rating to the far right.
it("gives every column a width so the spacing between columns is even", async () => {
	const user = await open();
	const widths = () =>
		Array.from(document.querySelectorAll("colgroup col")).map(
			(col) => (col as HTMLElement).style.width,
		);
	expect(widths().length).toBeGreaterThan(0);
	expect(widths().every(Boolean)).toBe(true);
	await user.click(tab("Coaches"));
	expect(widths().length).toBeGreaterThan(0);
	expect(widths().every(Boolean)).toBe(true);
});
