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
import { namedDraft, renderWithDraftCore, seedNextSeries } from "./draft-core";
import { fakeAssets } from "./fake-assets";

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
	seedNextSeries();
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await user.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
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
		await user.hover(ban);
		expect((await screen.findByRole("tooltip")).textContent).toBe(name);
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

	test("on my pick turn, confirming sends draft.pick and the preview locks in the same player row", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await toFirstPick(user);
		const free = firstAvailable();
		const name = free.getAttribute("aria-label") ?? "";
		await user.click(free);
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const first = within(blue).getAllByRole("button")[0] as HTMLElement;
		expect(within(first).getByRole("img", { name })).toBeTruthy();
		await user.click(confirm());
		expect(core.sent.at(-1)).toMatchObject({ kind: "draft.pick" });
		expect(within(first).getByRole("img", { name })).toBeTruthy();
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

	test("an unavailable champion cannot be confirmed and gives its reason in its tooltip and accessible name", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(tile("Cragbell"));
		await confirmAndWaitForRival();

		const banned = await waitFor(() => tile("Cragbell. Banned in this game"));
		expect(banned.getAttribute("aria-disabled")).toBe("true");
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
		seedNextSeries();
		await user.click(screen.getByRole("button", { name: "Start series" }));
		await user.click(
			await screen.findByRole("button", { name: "Confirm choice" }),
		);
		const go = await screen.findByRole("button", { name: "Go to draft" });
		commits = [];
		await user.click(go);
		await screen.findByRole("heading", { level: 1, name: "Draft" });
		// Mounting the whole board is the yardstick: it scales with the machine.
		const mount = Math.max(...commits);

		// One sample can catch a GC pause or JIT on a busy CI runner (#329):
		// confirm three bans and keep the cheapest. Noise only adds time, so a
		// real whole-board re-render still fails every sample.
		const samples: number[] = [];
		for (let ban = 0; ban < 3; ban++) {
			await user.click(firstAvailable());
			commits = [];
			await confirmAndWaitForRival();
			samples.push(Math.max(...commits));
			expect(core.sent.filter((c) => c.kind === "draft.ban")).toHaveLength(
				ban + 1,
			);
		}
		// Re-rendering the whole board would cost about a mount; half a mount
		// still catches that without failing on CI timing noise (Windows hit
		// 0.36 × mount). The Electron E2E measures the actual S1 frame budget.
		expect(Math.min(...samples)).toBeLessThan(mount / 2);
	});
});

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
