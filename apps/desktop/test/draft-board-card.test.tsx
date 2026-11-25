import { packagedDraftContent, packagedMatchContent } from "@rift-legends/core";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { toBoard } from "./draft-board-kit";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

describe("player card (U5)", () => {
	const forgeMid = packagedMatchContent.players.find(
		(p) => p.id === "forge-mid",
	);

	test("#376: clicking a player selects them and shows their 20 attributes by area", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const kilnara = within(blue).getByRole("button", { name: /Kilnara/ });
		await user.click(kilnara);

		expect(kilnara.getAttribute("aria-pressed")).toBe("true");
		const card = screen.getByRole("group", { name: /Player card/ });
		expect(card.hasAttribute("open")).toBe(true);
		expect(within(card).getByText(/Forge Mid$/)).toBeTruthy();
		for (const area of ["Lane", "Map", "Fight", "Mental", "Team"]) {
			expect(within(card).getByRole("heading", { name: area })).toBeTruthy();
		}
		expect(within(card).getAllByRole("definition")).toHaveLength(20);
		for (const label of ["Vision", "Farming"]) {
			expect(within(card).getByText(label).querySelector("svg")).toBeNull();
		}
		const composure = within(card).getByText("Composure").nextSibling;
		expect(composure?.textContent).toMatch(
			new RegExp(`^${forgeMid?.attributes.composure}`),
		);
	});

	test("lists the player's champion pool with mastery and accessible names", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		await user.click(within(blue).getByRole("button", { name: /Kilnara/ }));
		const card = screen.getByRole("group", { name: /Player card/ });
		const pool = within(card).getByRole("region", { name: "Champion pool" });
		const source = packagedDraftContent.players.find(
			(p) => p.id === "forge-mid",
		);
		const entries = within(pool).getAllByRole("listitem");
		const total =
			(source?.mains.length ?? 0) +
			(source?.secondary.length ?? 0) +
			(source?.weak.length ?? 0);
		expect(entries.length).toBeGreaterThan(0);
		expect(entries.length).toBeLessThanOrEqual(total);
		for (const entry of entries)
			expect(entry.getAttribute("aria-label")).toMatch(/, mastery \d+$/);
		expect(within(pool).getByText("Mains")).toBeTruthy();
	});

	test("dims attributes that matter little for the role, with an explanation", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		await user.click(within(red).getByRole("button", { name: /Gullix/ }));
		const card = screen.getByRole("group", { name: /Player card/ });
		const roaming = within(card).getByText("Roaming").closest("div");
		expect(roaming?.className).toContain("opacity-50");
		expect(roaming?.textContent).toContain("Matters little for this role");
		const composure = within(card).getByText("Composure").closest("div");
		expect(composure?.className).not.toContain("opacity-50");
	});

	test("colors values on a scale and keeps the level readable without color", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		await user.click(within(blue).getByRole("button", { name: /Kilnara/ }));
		const card = screen.getByRole("group", { name: /Player card/ });
		const cells = within(card).getAllByRole("definition");
		const level = (value: number) =>
			value >= 75 ? "High" : value <= 45 ? "Low" : "Medium";
		const composure = within(card).getByText("Composure")
			.nextSibling as Element;
		expect(composure.textContent).toContain(
			level(forgeMid?.attributes.composure ?? 0),
		);
		expect(cells.some((c) => c.className.includes("text-good"))).toBe(true);
		for (const cell of cells)
			expect(cell.textContent).toMatch(/\d+ (High|Medium|Low)/);
	});

	const kilnaraCard = async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		await user.click(within(blue).getByRole("button", { name: /Kilnara/ }));
		return screen.getByRole("group", { name: /Player card/ });
	};
	const fillOf = (value: number) =>
		value >= 75 ? "bg-good" : value <= 45 ? "bg-bad" : "bg-muted";

	test("#558: each area is a card and each attribute has a short bar in its level color, next to its number", async () => {
		const card = await kilnaraCard();
		for (const area of ["Lane", "Map", "Fight", "Mental", "Team"]) {
			const section = within(card)
				.getByRole("heading", { name: area })
				.closest("section");
			expect(section?.className).toMatch(/\bborder\b/);
		}
		const values = within(card).getAllByRole("definition");
		expect(values).toHaveLength(20);
		for (const value of values) {
			const number = Number(value.textContent?.match(/^\d+/)?.[0]);
			const bar = value.querySelector('[data-slot="level-bar"]');
			expect(bar?.getAttribute("aria-hidden")).toBe("true");
			const fill = bar?.firstElementChild as HTMLElement;
			expect(fill.style.width).toBe(`${number}%`);
			expect(fill.className).toContain(fillOf(number));
		}
		const composure = within(card).getByText("Composure").nextSibling;
		expect(composure?.textContent).toMatch(
			new RegExp(`^${forgeMid?.attributes.composure} (High|Medium|Low)$`),
		);
	});

	test("#558: the pool lists each group with its title, and a mastery bar and number under each portrait", async () => {
		const card = await kilnaraCard();
		const pool = within(card).getByRole("region", { name: "Champion pool" });
		const group = (name: string) => within(pool).getByRole("list", { name });
		const entries = [
			["Mains", "Glasswake", 90],
			["Secondary", "Rimefoil", 70],
			["Weak", "Waxblade", 35],
		] as const;
		for (const [title, champion, mastery] of entries) {
			const item = within(group(title)).getByRole("listitem", {
				name: `${champion}, mastery ${mastery}`,
			});
			expect(item.querySelector(`[data-tooltip="${champion}"]`)).not.toBeNull();
			const bar = item.querySelector('[data-slot="mastery-bar"]');
			expect(bar?.getAttribute("aria-hidden")).toBe("true");
			const fill = bar?.firstElementChild as HTMLElement;
			expect(fill.style.width).toBe(`${mastery}%`);
			expect(fill.className).toContain(fillOf(mastery));
			expect(
				item.querySelector('[data-slot="mastery-value"]')?.textContent,
			).toBe(String(mastery));
		}
		// Weak champions are dimmed; the others are not.
		expect(within(group("Weak")).getByRole("listitem").className).toMatch(
			/opacity-/,
		);
		expect(within(group("Mains")).getByRole("listitem").className).not.toMatch(
			/opacity-/,
		);
	});

	test("#376: hovering or focusing a player does not change the card", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		const gullix = within(red).getByRole("button", { name: /Gullix/ });
		await user.hover(gullix);
		fireEvent.focus(gullix);

		const card = screen.getByRole("group", { name: /Player card/ });
		expect(within(card).getByText(/Forge Mid$/)).toBeTruthy();
		expect(gullix.getAttribute("aria-pressed")).toBe("false");
	});

	test("#376: the keyboard selects a rival player with Enter or Space; one row is selected at a time", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		const pressed = () =>
			screen
				.getAllByRole("button", { pressed: true })
				.filter((row) => blue.contains(row) || red.contains(row));
		// Before any choice the card shows my mid laner, and its row says so.
		expect(pressed()).toEqual([
			within(blue).getByRole("button", { name: /Kilnara/ }),
		]);

		const gullix = within(red).getByRole("button", { name: /Gullix/ });
		gullix.focus();
		await user.keyboard("{Enter}");
		const card = screen.getByRole("group", { name: /Player card/ });
		expect(within(card).getByText(/Shoal ADC$/)).toBeTruthy();
		expect(
			within(card).getByText("Mechanics").nextSibling?.textContent,
		).toMatch(/^99/);
		expect(pressed()).toEqual([gullix]);
		expect(gullix.className).toMatch(/\baria-pressed:ring-2\b/);

		const pearlin = within(red).getByRole("button", { name: /Pearlin/ });
		pearlin.focus();
		await user.keyboard(" ");
		expect(within(card).getByText(/Shoal Support$/)).toBeTruthy();
		expect(pressed()).toEqual([pearlin]);
	});
});

describe("team logos (#376)", () => {
	test("the score and both columns show each team's logo; without one, its own crest", async () => {
		const user = userEvent.setup();
		const assets = fakeAssets({ state: "ready", version: "1.0" });
		const logo = "rift-asset://logos/teams/forge.png";
		assets.api.teamLogos.mockResolvedValue({ forge: logo });
		await renderWithDraftCore(<DraftScreen />, "en-US", undefined, undefined, {
			assets: assets.api,
		});
		await toBoard(user);
		const score = screen.getByRole("group", { name: "Series score" });
		await waitFor(() => expect(score.querySelector("img")).not.toBeNull());
		expect(
			[...score.querySelectorAll("img")].map((img) => img.getAttribute("src")),
		).toEqual([logo]);
		// Shoal has no logo: its own crest.
		expect(score.querySelectorAll("svg")).toHaveLength(1);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		expect(blue.querySelector("header img")?.getAttribute("src")).toBe(logo);
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		expect(red.querySelector("header img")).toBeNull();
		expect(red.querySelector("header svg")).not.toBeNull();
	});
});
