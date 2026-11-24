import { packagedDraftContent } from "@rift-legends/core";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import {
	confirm,
	confirmAndWaitForRival,
	tile,
	toBoard,
} from "./draft-board-kit";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

describe("draft board pool (U3)", () => {
	test("an unavailable champion cannot be confirmed and gives its reason in its tooltip and accessible name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(tile("Cragbell"));
		await confirmAndWaitForRival();

		const banned = await waitFor(() => tile("Cragbell. Banned in this game"));
		expect(banned.getAttribute("aria-disabled")).toBe("true");
		// #417: an unavailable tile keeps its frame but never glows.
		expect(
			banned.querySelector("[data-portrait-frame]")?.hasAttribute("data-glow"),
		).toBe(false);
		// The pointer is still on the tile from the first click.
		await user.unhover(banned);
		await user.hover(banned);
		expect((await screen.findByRole("tooltip")).textContent).toContain(
			"Banned in this game",
		);
		// Portrait initials and the tier badge only: the reason is in the tooltip.
		expect(banned.textContent).toBe("CRS");
		await user.click(banned);
		expect(banned.getAttribute("aria-pressed")).toBe("false");
		expect(confirm().hasAttribute("disabled")).toBe(true);
	});

	test("pool tiles and role filters name themselves in the Caja tooltip", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const grid = screen.getByRole("group", { name: "Champions" });
		const [tile] = within(grid).getAllByRole("button");
		if (!tile) throw new Error("The pool has no champions");
		await user.hover(tile);
		expect((await screen.findByRole("tooltip")).textContent).toBe(
			tile.getAttribute("aria-label"),
		);
		const jungle = within(
			screen.getByRole("group", { name: "Filter by role" }),
		).getByRole("button", { name: "Jungle" });
		await user.hover(jungle);
		await waitFor(() =>
			expect(screen.getByRole("tooltip").textContent).toBe("Jungle"),
		);
	});

	test("filters by role with icon buttons and searches by name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const grid = screen.getByRole("group", { name: "Champions" });
		expect(within(grid).getAllByRole("button")).toHaveLength(70);
		expect(screen.getByText("70 champions")).toBeTruthy();
		const filter = within(
			screen.getByRole("group", { name: "Filter by role" }),
		);
		const all = filter.getByRole("button", {
			name: "All roles",
			pressed: true,
		});
		for (const [role, name] of Object.entries({
			top: "Top",
			jungle: "Jungle",
			mid: "Mid",
			bot: "ADC",
			support: "Support",
		})) {
			const button = filter.getByRole("button", { name, pressed: false });
			expect(button.querySelector("svg, img")).toBeTruthy();
			await user.click(button);
			expect(filter.getAllByRole("button", { pressed: true })).toEqual([
				button,
			]);
			const expected = packagedDraftContent.champions
				.filter((champion) => champion.positions.some((p) => p.role === role))
				.map((champion) => champion.name);
			const shown = within(grid).getAllByRole("button");
			expect(
				shown.map((tile) => tile.getAttribute("aria-label")).sort(),
			).toEqual(expected.sort());
		}

		await user.click(all);
		expect(filter.getAllByRole("button", { pressed: true })).toEqual([all]);
		expect(within(grid).getAllByRole("button")).toHaveLength(70);

		await user.click(filter.getByRole("button", { name: "Jungle" }));
		await user.type(screen.getByRole("searchbox"), "dusk");
		expect(within(grid).getAllByRole("button")).toHaveLength(1);
		expect(screen.getByText("1 of 70")).toBeTruthy();

		await user.type(screen.getByRole("searchbox"), "zzz");
		expect(within(grid).queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByText("No matches")).toBeTruthy();
	});

	test("a champion tile shows only its portrait; the name is its accessible name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const cragbell = tile("Cragbell");
		const tier = cragbell.querySelector('[data-slot="tier"]');
		expect(cragbell.textContent).toBe(`CR${tier?.textContent}`);
		expect(within(cragbell).getByRole("img", { hidden: true })).toBeTruthy();
		// No info icon: its only icon is the right-click hint for the card.
		await user.hover(cragbell);
		const icons = [...cragbell.querySelectorAll("svg")];
		expect(icons.map((icon) => icon.dataset.slot)).toEqual(["card-hint"]);
	});

	test("#376: each tile shows its tier for the role filter, or its best role's tier", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const tierOf = (name: string) =>
			tile(name).querySelector('[data-slot="tier"]')?.textContent;
		// Rimefoil: Top B, Mid A.
		expect(tierOf("Rimefoil")).toBe("A");
		expect(tile("Rimefoil").getAttribute("aria-description")).toBe("Tier A");
		const filter = within(
			screen.getByRole("group", { name: "Filter by role" }),
		);
		await user.click(filter.getByRole("button", { name: "Top" }));
		expect(tierOf("Rimefoil")).toBe("B");
		expect(tierOf("Gravelspan")).toBe("S+");
		await user.click(filter.getByRole("button", { name: "Mid" }));
		expect(tierOf("Rimefoil")).toBe("A");
		await user.click(filter.getByRole("button", { name: "Jungle" }));
		expect(tierOf("Gravelspan")).toBe("B");
	});

	test("#398: the card hint shows the right-click icon on the tile and right click plus card in the pool header", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const hint = tile("Cragbell").querySelector('[data-slot="card-hint"]');
		expect(hint?.classList.contains("lucide-mouse-right")).toBe(true);
		const header = screen.getByRole("button", { name: "Right click: card" });
		expect(
			[...header.querySelectorAll("svg")].map((icon) =>
				[...icon.classList].find((c) => c.startsWith("lucide-")),
			),
		).toEqual(["lucide-mouse-right", "lucide-id-card"]);
	});

	test("the selected tile is pressed and framed in the action colour; only it", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const mark = (button: HTMLElement) =>
			button.querySelector('[data-slot="selection"]');
		const cragbell = tile("Cragbell");
		expect(mark(cragbell)).toBeNull();

		await user.click(cragbell);
		expect(cragbell.getAttribute("aria-pressed")).toBe("true");
		expect(mark(cragbell)?.className).toMatch(/\bring-action\b/);
		expect(mark(cragbell)?.className).toMatch(/\bbg-action\//);
		const grid = screen.getByRole("group", { name: "Champions" });
		expect(grid.querySelectorAll('[data-slot="selection"]')).toHaveLength(1);

		const rimefoil = tile("Rimefoil");
		await user.click(rimefoil);
		expect(mark(cragbell)).toBeNull();
		expect(mark(rimefoil)).not.toBeNull();
		expect(cragbell.getAttribute("aria-pressed")).toBe("false");
	});

	test("#417: every tile is framed and the selection stays distinct from normal, hover and focus", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const grid = screen.getByRole("group", { name: "Champions" });
		const tiles = within(grid).getAllByRole("button");
		for (const button of tiles)
			expect(button.querySelector("[data-portrait-frame]")).not.toBeNull();

		const cragbell = tile("Cragbell");
		await user.click(cragbell);
		const frame = cragbell.querySelector("[data-portrait-frame]");
		const mark = cragbell.querySelector('[data-slot="selection"]');
		// The selection (action ring and tint) is painted over the frame.
		expect(frame?.compareDocumentPosition(mark as Node)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		expect(mark?.className).toMatch(/\bring-action\b/);
		expect(mark?.className).toMatch(/\bbg-action\//);
		// Normal and hover (the frame's glow) never carry the tint; focus is an outline.
		expect(frame?.hasAttribute("data-glow")).toBe(true);
		for (const cls of [frame?.className ?? "", cragbell.className]) {
			expect(cls).not.toMatch(/\bring-action\b|\bbg-action\//);
		}
		expect(cragbell.className).toMatch(/\bfocus-visible:outline-action\b/);
		expect(cragbell.className).not.toMatch(/\bhover:/);
	});

	test("the keyboard moves through the grid with arrows, selects with Enter and confirms", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const buttons = within(
			screen.getByRole("group", { name: "Champions" }),
		).getAllByRole("button");

		buttons[0]?.focus();
		await user.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(buttons[1]);
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(buttons[7]);
		await user.keyboard("{ArrowLeft}{ArrowUp}");
		expect(document.activeElement).toBe(buttons[0]);
		expect(buttons[0]?.tabIndex).toBe(0);
		expect(buttons[1]?.tabIndex).toBe(-1);

		await user.keyboard("{ArrowRight}{Enter}");
		expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
		await user.tab();
		expect(document.activeElement).toBe(confirm());
		await user.keyboard("{Enter}");
		expect(core.sent.at(-1)).toMatchObject({
			kind: "draft.ban",
			payload: { champion: "rimefoil" },
		});
	});
});
