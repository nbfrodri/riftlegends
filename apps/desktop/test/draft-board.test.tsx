import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import {
	choose,
	confirm,
	confirmAndWaitForRival,
	firstAvailable,
	tile,
	toBoard,
	toFirstPick,
} from "./draft-board-kit";
import { namedDraft, renderWithDraftCore, seedNextSeries } from "./draft-core";

afterEach(() => {
	cleanup();
	localStorage.removeItem("riftlegends.draft.aiPanel.open");
});

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
		// #436: the slot of the ban being chosen is marked from the start.
		const blueSlots = within(
			within(screen.getByRole("region", { name: "Blue side Forge" })).getByRole(
				"list",
				{ name: "Bans" },
			),
		).getAllByRole("listitem");
		expect(blueSlots[0]?.getAttribute("aria-current")).toBe("step");
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

	test("#430: the inspection bars sit above the board and open downward", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const board = screen.getByRole("region", { name: "Blue side Forge" });
		for (const name of [/^Player card/, /^AI decisions/]) {
			const bar = screen.getByRole("group", { name });
			expect(
				bar.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
			const body = bar.querySelector('[data-slot="panel-body"]');
			expect(body?.className).toContain("top-full");
			expect(body?.className).not.toContain("bottom-full");
		}
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

	test("#398: before lock-in the selection previews in the picking player's row and follows a new selection", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toFirstPick(user);
		const [one, two] = within(screen.getByRole("group", { name: "Champions" }))
			.getAllByRole("button")
			.filter((button) => !button.hasAttribute("aria-disabled"));
		if (!one || !two) throw new Error("two free champions are needed");
		const blue = screen.getByRole("region", { name: "Blue side Forge" });
		const row = () => within(blue).getAllByRole("button")[0] as HTMLElement;
		const first = one.getAttribute("aria-label") ?? "";
		const second = two.getAttribute("aria-label") ?? "";
		await user.click(one);
		expect(within(row()).getByRole("img", { name: first })).toBeTruthy();
		await user.click(two);
		expect(within(row()).getByRole("img", { name: second })).toBeTruthy();
		expect(within(row()).queryByRole("img", { name: first })).toBeNull();
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

describe("#546: dismissing the AI decisions panel", () => {
	const panel = () =>
		screen.getByRole("group", { name: "AI decisions" }) as HTMLDetailsElement;
	const bar = () => within(panel()).getByText("AI decisions");

	test.each([
		[
			"a click on empty space",
			(user: ReturnType<typeof userEvent.setup>) =>
				user.click(screen.getByRole("region", { name: "Champions" })),
		],
		[
			"a click on a champion",
			(user: ReturnType<typeof userEvent.setup>) =>
				user.click(tile("Cragbell")),
		],
		[
			"Escape from the bar",
			(user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}"),
		],
	])("closes on %s", async (_, dismiss) => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(bar());
		expect(panel().open).toBe(true);

		await dismiss(user);

		expect(panel().open).toBe(false);
	});

	test("stays open on a click inside and its bar can still toggle it", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		await user.click(bar());
		expect(panel().open).toBe(true);

		await user.click(
			within(panel()).getByText("The rival has not made a decision yet."),
		);
		expect(panel().open).toBe(true);

		await user.click(bar());
		expect(panel().open).toBe(false);
	});
});

describe("#469: a click on empty space clears the selection", () => {
	const pool = () => screen.getByRole("region", { name: "Champions" });
	const blue = () => screen.getByRole("region", { name: "Blue side Forge" });
	const red = () => screen.getByRole("region", { name: /^Red side/ });
	const rows = (side: HTMLElement) =>
		within(within(side).getAllByRole("list")[0] as HTMLElement).getAllByRole(
			"button",
		);
	const pressedRows = () =>
		[...rows(blue()), ...rows(red())].filter(
			(row) => row.getAttribute("aria-pressed") === "true",
		);

	test("clears the champion, its pick preview and the player; another click selects again", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toFirstPick(user);
		const free = firstAvailable();
		const name = free.getAttribute("aria-label") ?? "";
		await user.click(free);
		const rival = rows(red())[1] as HTMLElement;
		await user.click(rival);
		const first = rows(blue())[0] as HTMLElement;
		expect(within(first).getByRole("img", { name })).toBeTruthy();
		expect(pressedRows()).toEqual([rival]);

		await user.click(pool());

		expect(free.getAttribute("aria-pressed")).toBe("false");
		expect(within(first).queryByRole("img", { name })).toBeNull();
		expect(confirm().hasAttribute("disabled")).toBe(true);
		expect(pressedRows()).toEqual([]);
		// The player card closes with the selection instead of staying open
		// and empty (user, 25-11).
		expect(
			(
				screen.getByRole("group", {
					name: /^Player card/,
				}) as HTMLDetailsElement
			).open,
		).toBe(false);

		// Clicks on a champion or a player still select, as before.
		await user.click(free);
		await user.click(rival);
		expect(free.getAttribute("aria-pressed")).toBe("true");
		expect(pressedRows()).toEqual([rival]);
		// The empty part of a team column is empty space too.
		await user.click(blue());
		expect(free.getAttribute("aria-pressed")).toBe("false");
		expect(pressedRows()).toEqual([]);
	});

	test("clicks on controls, the turn bar and the inspection bars keep it", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const champion = tile("Cragbell");
		await user.click(champion);
		const rival = rows(red())[2] as HTMLElement;
		await user.click(rival);

		const card = screen.getByRole("group", { name: /^Player card/ });
		const ai = screen.getByRole("group", { name: /^AI decisions/ });
		const targets = [
			() => screen.getByRole("searchbox"),
			() => screen.getByRole("button", { name: "All roles" }),
			() => screen.getByText("Ban 1 · Forge"),
			() => screen.getByRole("heading", { name: "Cragbell" }),
			() => within(card).getByText("Player card", { exact: true }),
			() => card.querySelector('[data-slot="panel-body"]') as HTMLElement,
			() => within(ai).getByText("AI decisions", { exact: true }),
		];
		for (const target of targets) {
			await user.click(target());
			expect(champion.getAttribute("aria-pressed")).toBe("true");
			expect(pressedRows()).toEqual([rival]);
		}
		expect(confirm().hasAttribute("disabled")).toBe(false);
	});

	test("Escape on the board clears it too, but first closes an open champion card", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		const champion = tile("Cragbell");
		await user.click(champion);
		fireEvent.contextMenu(champion);
		const card = await screen.findByRole("region", {
			name: "Champion card: Cragbell",
		});

		await user.keyboard("{Escape}");
		expect(card.isConnected).toBe(false);
		expect(champion.getAttribute("aria-pressed")).toBe("true");

		await user.keyboard("{Escape}");
		expect(champion.getAttribute("aria-pressed")).toBe("false");
		expect(confirm().hasAttribute("disabled")).toBe(true);
	});
});
