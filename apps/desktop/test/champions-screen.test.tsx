import { loadRealContent } from "@rift-legends/core";
import { RouterProvider } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets, testCatalog } from "./fake-assets";

afterEach(cleanup);

const tier = (rank: string) =>
	within(screen.getByRole("region", { name: `Tier ${rank}` }));
const button = (name: string) => screen.getByRole("button", { name });

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
		{ assets: assets.api },
	);
	const user = userEvent.setup();
	await screen.findByRole("heading", { name: "Set up series" });
	if (ready) {
		const real = screen.getByRole("radio", {
			name: "Real LoL",
		}) as HTMLInputElement;
		await waitFor(() => expect(real.disabled).toBe(false));
		await user.click(real);
	}
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

it("uses the selected real content, its season, localized tile art and relations before a series starts", async () => {
	const user = await open(true);
	const tile = await screen.findByRole("button", { name: "Aatrox EN" });
	expect(screen.getByText(`Season ${loadRealContent().season}`)).toBeTruthy();
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
});
