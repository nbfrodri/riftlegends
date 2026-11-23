import { packagedDraftContent, packagedMatchContent } from "@rift-legends/core";
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

// Counts the renders of each pool tile's face, by champion.
const poolFaces = vi.hoisted(() => ({ renders: new Map<string, number>() }));
vi.mock("@rift-legends/ui-kit/components/champion-face", async (original) => {
	const real =
		await original<
			typeof import("@rift-legends/ui-kit/components/champion-face")
		>();
	return {
		...real,
		ChampionFace: (props: Parameters<typeof real.ChampionFace>[0]) => {
			if (props.size === "pool")
				poolFaces.renders.set(
					props.id,
					(poolFaces.renders.get(props.id) ?? 0) + 1,
				);
			return real.ChampionFace(props);
		},
	};
});

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

function firstAvailable() {
	const available = within(screen.getByRole("group", { name: "Champions" }))
		.getAllByRole("button")
		.find((button) => !button.hasAttribute("aria-disabled"));
	if (!available) throw new Error("no free champion");
	return available;
}

async function toFirstPick(user: User) {
	await toBoard(user);
	for (let ban = 0; ban < 3; ban++) {
		await user.click(firstAvailable());
		await confirmAndWaitForRival();
	}
	await screen.findByText("B1 · Forge pick");
}

describe("draft board (U3)", () => {
	test("on my ban turn, selecting and confirming sends draft.ban; the ban shows its greyed portrait", async () => {
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
		const bans = within(blue).getByRole("list", { name: "Bans" });
		const ban = await within(bans).findByRole("img", { name });
		expect(ban.className).toContain("after:bg-[linear-gradient");
		expect(within(bans).getByRole("listitem").getAttribute("title")).toBe(name);
		expect(bans.querySelector("s")).toBeNull();
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
		await toFirstPick(user);
		const free = firstAvailable();
		const name = free.getAttribute("aria-label") ?? "";
		await user.click(free);
		await user.click(confirm());

		expect(core.sent.at(-1)).toMatchObject({ kind: "draft.pick" });
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const first = await within(blue).findByRole("button", {
			name: new RegExp(`^B1 ${name} Emberjaw`),
		});
		expect(first.querySelector("svg")).toBeTruthy();
		expect(tile(`${name}. Already picked in this game`)).toBeTruthy();
	});

	test("confirming a pick renders the pool and picking column only when the pick arrives", async () => {
		const user = userEvent.setup();
		const { api, i18n } = await renderWithDraftCore(<DraftScreen />);
		// Each of these headings is translated once per render of its component.
		const translate = vi.spyOn(i18n, "t");
		const renders = () => {
			const keys = translate.mock.calls.map(([key]) => key);
			return {
				pool: keys.filter((key) => key === "draft.board.pool").length,
				blue: keys.filter((key) => key === "draft.side.blue").length,
				red: keys.filter((key) => key === "draft.side.red").length,
			};
		};
		await toFirstPick(user);
		const choice = firstAvailable();
		const name = choice.getAttribute("aria-label");
		await user.click(choice);
		for (const count of Object.values(renders()))
			expect(count).toBeGreaterThan(0);
		translate.mockClear();

		// Separate the command acknowledgement from the refreshed draft view.
		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const query = api.query.getMockImplementation();
		if (!query) throw new Error("no draft query implementation");
		api.query.mockImplementationOnce(async (request) => {
			await held;
			return query(request);
		});
		fireEvent.click(confirm());
		await waitFor(() =>
			expect(api.send).toHaveLastResolvedWith(
				expect.objectContaining({
					ok: true,
					facts: expect.arrayContaining([
						expect.objectContaining({ type: "draft.picked" }),
					]),
				}),
			),
		);
		const pending = renders();
		release();
		await waitFor(() => tile(`${name}. Already picked in this game`));

		expect({ pending, total: renders() }).toEqual({
			pending: { pool: 0, blue: 0, red: 0 },
			total: { pool: 1, blue: 1, red: 0 },
		});
	});

	test("confirming a ban re-renders no pool tile until the view arrives, then only the banned one", async () => {
		const user = userEvent.setup();
		const { api } = await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(tile("Cragbell"));
		poolFaces.renders.clear();

		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const query = api.query.getMockImplementation();
		if (!query) throw new Error("no draft query implementation");
		api.query.mockImplementationOnce(async (request) => {
			await held;
			return query(request);
		});
		fireEvent.click(confirm());
		await waitFor(() =>
			expect(api.send).toHaveLastResolvedWith(
				expect.objectContaining({ ok: true }),
			),
		);
		const pending = Object.fromEntries(poolFaces.renders);
		release();
		await waitFor(() => tile("Cragbell. Banned in this game"));

		expect({ pending, total: Object.fromEntries(poolFaces.renders) }).toEqual({
			pending: {},
			total: { cragbell: 1 },
		});
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
		expect(banned.textContent).toBe("CR");
		await user.click(banned);
		expect(banned.getAttribute("aria-pressed")).toBe("false");
		expect(confirm().hasAttribute("disabled")).toBe(true);
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
		expect(cragbell.textContent).toBe("CR");
		expect(within(cragbell).getByRole("img", { hidden: true })).toBeTruthy();
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
		// Re-rendering the whole board would cost about a mount; half a mount
		// still catches that without failing on CI timing noise (Windows hit
		// 0.36 × mount). The Electron E2E measures the actual S1 frame budget.
		expect(Math.max(...commits)).toBeLessThan(mount / 2);
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
		await user.hover(within(blue).getByRole("button", { name: /Kilnara/ }));

		const card = screen.getByRole("group", { name: /Player card/ });
		expect(card.hasAttribute("open")).toBe(true);
		expect(within(card).getByText(/Forge Mid$/)).toBeTruthy();
		for (const area of ["Lane", "Map", "Fight", "Mental", "Team"]) {
			expect(within(card).getByRole("heading", { name: area })).toBeTruthy();
		}
		expect(within(card).getAllByRole("definition")).toHaveLength(20);
		for (const label of ["Vision", "Farming"]) {
			expect(within(card).getByText(label).querySelector("svg")).toBeTruthy();
		}
		const composure = within(card).getByText("Composure").nextSibling;
		expect(composure?.textContent).toBe(String(forgeMid?.attributes.composure));
	});

	test("focusing a rival player shows theirs too", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const red = screen.getByRole("region", { name: "Red side Shoal" });
		fireEvent.focus(within(red).getByRole("button", { name: /Gullix/ }));

		const card = screen.getByRole("group", { name: /Player card/ });
		expect(within(card).getByText(/Shoal ADC$/)).toBeTruthy();
		expect(within(card).getByText("Mechanics").nextSibling?.textContent).toBe(
			"99",
		);
	});
});
