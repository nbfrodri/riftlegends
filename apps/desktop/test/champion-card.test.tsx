import { packagedDraftContent } from "@rift-legends/core";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { renderWithDraftCore, seedNextSeries } from "./draft-core";

afterEach(cleanup);
const queryCard = () => screen.queryByRole("region", { name: /Champion card/ });
async function board() {
	const fixture: typeof packagedDraftContent = {
		...packagedDraftContent,
		matchups: [
			{
				champion: "rimefoil",
				against: "cragbell",
				role: "top",
				value: -9,
				reasons: ["range"],
			},
		],
		counters: [
			{
				champion: "rimefoil",
				against: "waxblade",
				value: 8,
				reasons: ["peelVsDive"],
			},
		],
		synergies: [
			{ a: "duskroot", b: "rimefoil", value: 6, reasons: ["chainCc"] },
			{ a: "rimefoil", b: "waxblade", value: 5 },
		],
	};
	const user = userEvent.setup();
	const core = await renderWithDraftCore(
		<DraftScreen />,
		"en-US",
		undefined,
		fixture,
	);
	await screen.findByRole("heading", { name: "Set up series" });
	seedNextSeries();
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await user.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
	await user.click(await screen.findByRole("button", { name: "Go to draft" }));
	const grid = within(await screen.findByRole("group", { name: "Champions" }));
	return {
		user,
		core,
		tile: grid.getByRole("button", { name: "Rimefoil" }),
		next: grid.getByRole("button", { name: "Cragbell" }),
	};
}

it("lazily previews one named card on hover, pins by right click and closes on Escape", async () => {
	const { user, core, tile, next } = await board();
	expect(
		core.api.query.mock.calls.some(([q]) => q.kind === "draft.champion"),
	).toBe(false);
	await user.hover(tile);
	const card = within(
		await screen.findByRole("region", { name: "Champion card: Rimefoil" }),
	);
	expect(await card.findByText("Magic")).toBeTruthy();
	for (const text of [
		"Mid",
		"Top",
		"Tier B",
		"Tier A",
		"Early game",
		"Poke",
		"Crowd control",
		"Mobility",
		"Frontline",
	])
		expect(card.getAllByText(text).length).toBeGreaterThan(0);
	const section = (name: string) => within(card.getByRole("region", { name }));
	expect(section("Wins against").getByText("Waxblade")).toBeTruthy();
	expect(section("Wins against").getByText("Team counter")).toBeTruthy();
	expect(section("Loses to").getByText("Cragbell")).toBeTruthy();
	expect(
		section("Loses to").getByText("Cragbell can trade from farther away."),
	).toBeTruthy();
	expect(
		section("Loses to").getByText("Overwhelming disadvantage"),
	).toBeTruthy();
	expect(section("Synergies").getByText("Duskroot")).toBeTruthy();
	expect(
		section("In this game").getByText("No related picks yet."),
	).toBeTruthy();
	await user.unhover(tile);
	await waitFor(() => expect(queryCard()).toBeNull());
	fireEvent.contextMenu(tile);
	await user.hover(next);
	expect(queryCard()?.getAttribute("aria-label")).toBe(
		"Champion card: Rimefoil",
	);
	expect(tile.getAttribute("aria-pressed")).toBe("false");
	await user.keyboard("{Escape}");
	expect(queryCard()).toBeNull();
});

it("opens on focus, closes on blur and lets the keyboard pin and dismiss it", async () => {
	const { user, tile, next } = await board();
	fireEvent.focus(tile);
	expect(
		await screen.findByRole("region", { name: "Champion card: Rimefoil" }),
	).toBeTruthy();
	fireEvent.blur(tile);
	await waitFor(() => expect(queryCard()).toBeNull());
	tile.focus();
	await user.keyboard("i");
	fireEvent.focus(next);
	expect(
		await screen.findByRole("button", { name: "Close champion card" }),
	).toBeTruthy();
	expect(queryCard()?.getAttribute("aria-label")).toBe(
		"Champion card: Rimefoil",
	);
	await user.keyboard("{Escape}");
	expect(queryCard()).toBeNull();
});

it("keeps the shortcut discoverable after the first visit", async () => {
	localStorage.clear();
	const first = await board();
	expect(screen.getByText(/Hover or focus a champion/)).toBeTruthy();
	first.core.unmount();
	await board();
	expect(screen.queryByText(/Hover or focus a champion/)).toBeNull();
	expect(screen.getByText("Right click: card")).toBeTruthy();
});

it("updates a pinned card as allies and enemies lock in their picks", async () => {
	const { core, tile } = await board();
	fireEvent.contextMenu(tile);
	await act(async () => {
		for (let pair = 0; pair < 3; pair++) {
			core.act("draft.ban", { team: "forge", champion: null });
			core.act("draft.ban", { team: "shoal", champion: null });
		}
		core.act("draft.pick", { team: "forge", champion: "duskroot" });
		core.act("draft.pick", { team: "shoal", champion: "cragbell" });
		core.act("draft.pick", { team: "shoal", champion: "waxblade" });
	});
	const game = within(
		await screen.findByRole("region", { name: "In this game" }),
	);
	for (const name of ["Duskroot", "Waxblade", "Cragbell"])
		expect(await game.findByText(name)).toBeTruthy();
	expect(game.getByText("Cragbell can trade from farther away.")).toBeTruthy();
	expect(game.getByText("They can chain their crowd control.")).toBeTruthy();
});

it("keeps the pinned card while the user selects and confirms another champion", async () => {
	const { core, user, tile, next } = await board();
	fireEvent.contextMenu(tile);
	await user.click(next);
	await user.click(screen.getByRole("button", { name: "Confirm ban" }));
	expect(core.sent.at(-1)).toMatchObject({
		kind: "draft.ban",
		payload: { champion: "cragbell" },
	});
	expect(queryCard()?.getAttribute("aria-label")).toBe(
		"Champion card: Rimefoil",
	);
});

it("can click through a draft turn without loading an incidental card on pointer focus", async () => {
	const { core, user, tile } = await board();
	await user.click(tile);
	await user.click(screen.getByRole("button", { name: "Confirm ban" }));
	expect(core.sent.at(-1)?.kind).toBe("draft.ban");
	expect(
		core.api.query.mock.calls.some(([q]) => q.kind === "draft.champion"),
	).toBe(false);
});

it("explains the pin shortcut in the Caja tooltip of the hint", async () => {
	const { user } = await board();
	const hint = screen.getByRole("button", { name: "Right click: card" });
	expect(hint.hasAttribute("title")).toBe(false);
	await user.hover(hint);
	const tooltip = await screen.findByRole("tooltip");
	expect(tooltip.textContent).toBe(
		"Pin the card with right click or the key. Escape closes it.I",
	);
	expect(within(tooltip).getByText("I").tagName).toBe("KBD");
});

it("opens pool tooltips away from the side where the card appears", async () => {
	const { tile } = await board();
	expect(tile.hasAttribute("title")).toBe(false);
	expect(tile.dataset.tooltipSide).toBe("left");
});

it("shows no filler text for a relation without reasons", async () => {
	const { user, tile } = await board();
	await user.hover(tile);
	const card = within(
		await screen.findByRole("region", { name: "Champion card: Rimefoil" }),
	);
	const synergies = within(
		await card.findByRole("region", { name: "Synergies" }),
	);
	expect(synergies.getByText("Waxblade")).toBeTruthy();
	expect(card.queryByText("No specific interaction listed.")).toBeNull();
});
