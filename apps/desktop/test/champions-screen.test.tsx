import { loadRealContent, packagedDraftContent } from "@rift-legends/core";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets, testCatalog } from "./fake-assets";

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
});

const tier = (rank: string) =>
	within(screen.getByRole("region", { name: `Tier ${rank}` }));
const button = (name: string) => screen.getByRole("button", { name });

/** Fictional content only through the test seam: the UI never offers it. */
async function open(ready = false) {
	const ids = ready ? loadRealContent().draft.champions.map((c) => c.id) : [];
	const assets = ready
		? fakeAssets({ state: "ready", version: "16.23" }, testCatalog(ids))
		: fakeAssets();
	await renderWithDraftCore(
		<RouterProvider router={createAppRouter()} />,
		"en-US",
		undefined,
		undefined,
		{ assets: assets.api, content: ready ? "real" : "fictional" },
	);
	const user = userEvent.setup();
	await screen.findByRole("heading", { name: "Set up series" });
	await user.click(
		within(screen.getByRole("navigation", { name: "Club sections" })).getByRole(
			"button",
			{ name: "Champions" },
		),
	);
	return user;
}

it("orders all six tiers and ranks flex champions for the chosen role", async () => {
	const user = await open();
	await screen.findByRole("heading", { name: "Champions" });
	expect(
		screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
	).toEqual(["S+", "S", "A", "B", "C", "D"]);
	expect(tier("S").getByRole("button", { name: "Cragbell" })).toBeTruthy();
	expect(tier("B").getByRole("button", { name: "Rimefoil" })).toBeTruthy();
	await user.click(button("Mid"));
	expect(tier("A").getByRole("button", { name: "Rimefoil" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Cragbell" })).toBeNull();
	const search = screen.getByRole("searchbox", { name: "Search champion" });
	await user.type(search, "MEfo");
	expect(
		screen
			.getAllByRole("region")
			.flatMap((row) => within(row).queryAllByRole("button")),
	).toEqual([button("Rimefoil")]);
	await user.type(search, "x");
	expect(screen.getByText("No matches")).toBeTruthy();
});

it("shows portraits without names: the name is the label and the tooltip", async () => {
	const user = await open();
	const tile = await screen.findByRole("button", { name: "Cragbell" });
	expect(within(tile).queryByText("Cragbell")).toBeNull();
	await user.hover(tile);
	expect((await screen.findByRole("tooltip")).textContent).toContain(
		"Cragbell",
	);
});

it("opens the full card and returns focus to the tile on Escape", async () => {
	const user = await open();
	const tile = await screen.findByRole("button", { name: "Cragbell" });
	await user.click(tile);
	const card = within(
		screen.getByRole("region", { name: "Champion card: Cragbell" }),
	);
	expect(await card.findByRole("heading", { name: "Synergies" })).toBeTruthy();
	expect(card.getByText("Duskroot")).toBeTruthy();
	await user.keyboard("{Escape}");
	expect(
		screen.queryByRole("region", { name: "Champion card: Cragbell" }),
	).toBeNull();
	expect(document.activeElement).toBe(tile);
});

it("closes the card on a click outside it, not inside, and returns focus", async () => {
	const user = await open();
	const tile = await screen.findByRole("button", { name: "Cragbell" });
	await user.click(tile);
	const region = () =>
		screen.queryByRole("region", { name: "Champion card: Cragbell" });
	await user.click(
		await within(region() as HTMLElement).findByRole("heading", {
			name: "Synergies",
		}),
	);
	expect(region()).not.toBeNull();
	await user.click(screen.getByRole("dialog", { name: "Champion card" }));
	expect(region()).toBeNull();
	expect(document.activeElement).toBe(tile);
});

it("shows the card without the action-colored top border", async () => {
	const user = await open();
	await user.click(await screen.findByRole("button", { name: "Cragbell" }));
	const card = screen.getByRole("region", { name: "Champion card: Cragbell" });
	expect(card.className).not.toMatch(/border-t-action/);
});

const viewSwitch = () => screen.getByRole("radiogroup", { name: "View" });
const fullList = () =>
	within(screen.getByRole("list", { name: "All champions" }));
const listed = () =>
	fullList()
		.getAllByRole("listitem")
		.map((item) => within(item).getByRole("button").getAttribute("aria-label"));

it("lists every champion by name with its roles and tiers, and opens its card", async () => {
	const user = await open();
	await screen.findByRole("heading", { name: "Champions" });
	await user.click(
		within(viewSwitch()).getByRole("radio", { name: "Full list" }),
	);
	const names = packagedDraftContent.champions
		.map((c) => c.name)
		.sort((a, b) => a.localeCompare(b, "en-US"));
	expect(listed()).toEqual(names);
	const row = within(fullList().getByRole("button", { name: "Rimefoil" }));
	const tierOf = (role: string) =>
		row.getByRole("img", { name: role }).nextElementSibling?.textContent;
	expect([tierOf("Top"), tierOf("Mid")]).toEqual(["B", "A"]);
	await user.type(
		screen.getByRole("searchbox", { name: "Search champion" }),
		"MEfo",
	);
	expect(listed()).toEqual(["Rimefoil"]);
	await user.click(fullList().getByRole("button", { name: "Rimefoil" }));
	expect(
		await screen.findByRole("region", { name: "Champion card: Rimefoil" }),
	).toBeTruthy();
});

it("keeps the role and the search when switching views", async () => {
	const user = await open();
	await screen.findByRole("heading", { name: "Champions" });
	await user.click(button("Mid"));
	const search = screen.getByRole("searchbox", { name: "Search champion" });
	await user.type(search, "rime");
	await user.click(
		within(viewSwitch()).getByRole("radio", { name: "Full list" }),
	);
	expect(listed()).toEqual(["Rimefoil"]);
	await user.click(
		within(viewSwitch()).getByRole("radio", { name: "Tier list" }),
	);
	expect(
		(
			screen.getByRole("searchbox", {
				name: "Search champion",
			}) as HTMLInputElement
		).value,
	).toBe("rime");
	expect(button("Mid").getAttribute("aria-pressed")).toBe("true");
	expect(tier("A").getByRole("button", { name: "Rimefoil" })).toBeTruthy();
});

it("uses the real content by default, without a season, localized tile art and relations before a series starts", async () => {
	const user = await open(true);
	const tile = await screen.findByRole("button", { name: "Aatrox EN" });
	expect(screen.queryByText(/season/i)).toBeNull();
	expect(tile.querySelector("img")?.getAttribute("src")).toBe(
		"rift-asset://cdragon/tiles/Aatrox.jpg",
	);
	fireEvent.error(tile.querySelector("img") as HTMLImageElement);
	expect(tile.querySelector("img")?.getAttribute("src")).toBe(
		"rift-asset://cdragon/champions/Aatrox.png",
	);
	await user.click(tile);
	const card = within(
		screen.getByRole("region", { name: "Champion card: Aatrox EN" }),
	);
	expect(
		await card.findByRole("heading", { name: "Wins against" }),
	).toBeTruthy();
	expect(card.getAllByText(/ EN$/).length).toBeGreaterThan(3);
	expect(screen.queryByText(/leaguepedia|communitydragon/i)).toBeNull();
}, 15_000);

it("opens a detail view with every relation by role, team counters and the team plans", async () => {
	const { draft } = loadRealContent();
	const synergies = draft.synergies.filter(
		({ a, b, value }) => (a === "Camille" || b === "Camille") && value > 0,
	).length;
	const user = await open(true);
	await user.click(await screen.findByRole("button", { name: "Camille EN" }));
	const card = within(
		screen.getByRole("region", { name: "Champion card: Camille EN" }),
	);
	const section = async (name: string) =>
		within(await card.findByRole("region", { name }));
	const wins = await section("Wins against");
	expect(wins.getByRole("heading", { name: "Top", level: 5 })).toBeTruthy();
	expect(
		wins.getByRole("heading", { name: "Team counters", level: 5 }),
	).toBeTruthy();
	expect((await section("Synergies")).getAllByRole("listitem")).toHaveLength(
		synergies,
	);
	expect(synergies).toBeGreaterThan(3);
	const plans = await section("Contributes to comps");
	const camille = draft.champions.find((c) => c.id === "Camille");
	const expected = draft.identities.filter(({ archetypes }) =>
		archetypes.some((a) => camille?.archetypes.includes(a)),
	);
	expect(plans.getAllByRole("listitem")).toHaveLength(expected.length);
	expect(expected.length).toBeGreaterThan(0);
}, 15_000);

it("names each team plan with the archetypes the champion brings", async () => {
	const user = await open();
	await user.click(await screen.findByRole("button", { name: "Cragbell" }));
	const plans = within(
		await screen.findByRole("region", { name: "Contributes to comps" }),
	);
	const item = plans.getByRole("listitem");
	expect(item.textContent).toContain("Engage and dive");
	expect(item.textContent).toContain("Engage");
});

it("frames every portrait in the tier list and in the full list", async () => {
	const user = await open();
	await screen.findByRole("heading", { name: "Champions" });
	const tiles = screen
		.getAllByRole("region")
		.flatMap((row) => within(row).queryAllByRole("button"));
	expect(tiles.length).toBeGreaterThan(0);
	for (const tile of tiles)
		expect(tile.querySelector("[data-portrait-frame]")).not.toBeNull();
	await user.click(within(viewSwitch()).getByRole("radio", { name: "Full list" }));
	const rows = fullList().getAllByRole("button");
	expect(rows.length).toBeGreaterThan(0);
	for (const row of rows)
		expect(row.querySelector("[data-portrait-frame]")).not.toBeNull();
});
