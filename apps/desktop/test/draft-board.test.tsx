import { packagedMatchContent } from "@rift-legends/core";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { namedDraft, renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;

/** Starts a series as Forge on the blue side: Forge bans first. */
async function toBoard(user: User) {
	await screen.findByRole("heading", { level: 1, name: "Set up series" });
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await user.click(await screen.findByRole("button", { name: "Go to draft" }));
	await screen.findByRole("heading", { level: 1, name: "Draft" });
}

const tile = (name: string | RegExp) =>
	within(screen.getByRole("group", { name: "Champions" })).getByRole("button", {
		name,
	});
const confirm = () => screen.getByRole("button", { name: /^Confirm/ });

async function choose(user: User, champion: string) {
	await user.click(tile(champion));
	await user.click(confirm());
}

async function confirmAndWaitForRival() {
	vi.useFakeTimers();
	try {
		fireEvent.click(confirm());
		await act(() => vi.advanceTimersByTimeAsync(10));
		await act(() => vi.advanceTimersByTimeAsync(pacing.aiPauseMs));
		await act(() => vi.advanceTimersByTimeAsync(10));
	} finally {
		vi.useRealTimers();
	}
}

describe("draft board (U3)", () => {
	test("on my ban turn, selecting and confirming sends draft.ban; the ban shows struck", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(
			<DraftScreen />,
			"en-US",
			undefined,
			namedDraft,
		);
		await toBoard(user);

		expect(screen.getByText("Ban 1 · Forge")).toBeTruthy();
		expect(confirm().hasAttribute("disabled")).toBe(true);
		const name = "The Unforgotten Guardian of Cragbell";
		await user.type(screen.getByRole("searchbox"), "guARDian of Crag");
		expect(
			within(screen.getByRole("group", { name: "Champions" })).getAllByRole(
				"button",
			),
		).toHaveLength(1);
		await choose(user, name);

		expect(core.sent.at(-1)).toMatchObject({
			kind: "draft.ban",
			payload: { team: "forge", champion: "cragbell" },
		});
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		await waitFor(() =>
			expect(
				within(blue).getByRole("list", { name: "Bans" }).textContent,
			).toContain(name),
		);
		expect(within(blue).getByText(name).tagName).toBe("S");
	});

	test("the user cannot confirm while the rival is choosing", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await choose(user, "Cragbell");

		expect(await screen.findByText("Shoal's turn")).toBeTruthy();
		await user.click(tile("Prismoth"));
		expect(confirm().hasAttribute("disabled")).toBe(true);
	});

	test("on my pick turn, confirming sends draft.pick and the pick shows in my column with its role", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		for (let ban = 0; ban < 3; ban++) {
			const pool = within(screen.getByRole("group", { name: "Champions" }));
			const available = pool
				.getAllByRole("button")
				.find((button) => !button.hasAttribute("aria-disabled"));
			if (!available) throw new Error("no free champion");
			await user.click(available);
			await confirmAndWaitForRival();
		}
		expect(await screen.findByText("B1 · Forge pick")).toBeTruthy();
		const free = within(screen.getByRole("group", { name: "Champions" }))
			.getAllByRole("button")
			.find((b) => b.getAttribute("aria-disabled") !== "true");
		if (!free) throw new Error("no free champion");
		const name = free.querySelector("b")?.textContent ?? "";
		await user.click(free);
		await user.click(confirm());

		expect(core.sent.at(-1)).toMatchObject({ kind: "draft.pick" });
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const first = await within(blue).findByRole("button", {
			name: new RegExp(`^B1 ${name} Forge`),
		});
		expect(first.querySelector("svg")).toBeTruthy();
		expect(tile(`${name}. Already picked in this game`)).toBeTruthy();
	});

	test("an unavailable champion cannot be confirmed and says why only in its accessible name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(tile("Cragbell"));
		await confirmAndWaitForRival();

		const banned = await waitFor(() => tile("Cragbell. Banned in this game"));
		expect(banned.getAttribute("aria-disabled")).toBe("true");
		expect(banned.getAttribute("title")).toBe("Banned in this game");
		expect(banned.textContent).toBe("CRCragbell");
		await user.click(banned);
		expect(banned.getAttribute("aria-pressed")).toBe("false");
		expect(confirm().hasAttribute("disabled")).toBe(true);
	});

	test("filters by role and searches by name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const grid = screen.getByRole("group", { name: "Champions" });
		expect(within(grid).getAllByRole("button")).toHaveLength(70);
		expect(screen.getByText("70 champions")).toBeTruthy();

		await user.click(screen.getByRole("combobox", { name: "Filter by role" }));
		await user.click(await screen.findByRole("option", { name: "Jungle" }));
		const jungle = within(grid).getAllByRole("button");
		expect(jungle.map((b) => b.textContent)).toContain("FRFrostdrum");
		expect(jungle.map((b) => b.textContent)).not.toContain("CRCragbell");

		await user.type(screen.getByRole("searchbox"), "dusk");
		expect(within(grid).getAllByRole("button")).toHaveLength(1);
		expect(screen.getByText("1 of 70")).toBeTruthy();

		await user.type(screen.getByRole("searchbox"), "zzz");
		expect(within(grid).queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByText("No matches")).toBeTruthy();
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

	test("confirming does no heavy work on the UI thread", async () => {
		const user = userEvent.setup();
		// Render time of each commit, from React's profiler.
		let commits: number[] = [];
		const core = await renderWithDraftCore(
			<Profiler id="draft" onRender={(...args) => commits.push(args[2])}>
				<DraftScreen />
			</Profiler>,
		);
		await screen.findByRole("heading", { level: 1, name: "Set up series" });
		await user.click(screen.getByRole("button", { name: "Start series" }));
		const go = await screen.findByRole("button", { name: "Go to draft" });
		commits = [];
		await user.click(go);
		await screen.findByRole("heading", { level: 1, name: "Draft" });
		// Mounting the whole board is the yardstick: it scales with the machine.
		const mount = Math.max(...commits);

		await user.click(tile("Cragbell"));
		commits = [];
		await user.click(confirm());
		await waitFor(() => tile("Cragbell. Banned in this game"));
		expect(core.sent.at(-1)?.kind).toBe("draft.ban");
		// The Electron E2E measures the actual S1 frame budget.
		expect(Math.max(...commits)).toBeLessThan(mount / 3);
	});
});

describe("player card (U5)", () => {
	const forgeMid = packagedMatchContent.players.find(
		(p) => p.id === "forge-mid",
	);

	test("hovering a player shows their 20 attributes by area", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		await user.hover(within(blue).getByRole("button", { name: /Forge Mid/ }));

		const card = screen.getByRole("group", { name: /Player card/ });
		expect(card.hasAttribute("open")).toBe(true);
		expect(within(card).getByText("Forge Mid")).toBeTruthy();
		for (const area of ["Lane", "Map", "Fight", "Mental", "Team"]) {
			expect(within(card).getByRole("heading", { name: area })).toBeTruthy();
		}
		expect(within(card).getAllByRole("definition")).toHaveLength(20);
		const composure = within(card).getByText("Composure").nextSibling;
		expect(composure?.textContent).toBe(String(forgeMid?.attributes.composure));
	});

	test("focusing a rival player shows theirs too", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		fireEvent.focus(within(red).getByRole("button", { name: /Shoal ADC/ }));

		const card = screen.getByRole("group", { name: /Player card/ });
		expect(within(card).getByText("Shoal ADC")).toBeTruthy();
		expect(within(card).getByText("Mechanics").nextSibling?.textContent).toBe(
			"99",
		);
	});
});
