import { draftFacts } from "@rift-legends/contracts";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DraftBoard } from "../src/renderer/draft/board/draft-board";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { draftStages } from "../src/renderer/draft/stages";
import { namedDraft, renderWithDraftCore, seedNextSeries } from "./draft-core";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	localStorage.clear();
});

type User = ReturnType<typeof userEvent.setup>;
type Decision = Extract<
	ReturnType<typeof draftFacts.schema.parse>,
	{ type: "ai.decided" }
>;

async function toBoard(user: User) {
	seedNextSeries();
	await user.click(await screen.findByRole("button", { name: "Start series" }));
	await user.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
	await user.click(await screen.findByRole("button", { name: "Go to draft" }));
	await screen.findByRole("heading", { level: 1, name: "Draft" });
}

const panel = () => screen.getByRole("group", { name: "AI decisions" });

const displayChampion = (id: string) =>
	namedDraft.champions.find((c) => c.id === id)?.name;

// Exercise the board with the real core while the test controls turn timing.
function ManualDraft() {
	const { mine, view } = useDraftSession();
	const Setup = draftStages.setup;
	if (!view || !mine) return <Setup />;
	if (view.phase === "side") return <p>Waiting for side choice</p>;
	return <DraftBoard />;
}

const reasonLabels: Record<string, string> = {
	meta: "Strength in this patch",
	comfort: "Player familiarity",
	matchup: "Lane matchup",
	synergy: "Fit with other champions",
	composition: "Team balance",
	flex: "Fits multiple roles",
	identity: "Fit with team strategy",
	fearlessReserve: "Value in later games",
	side: "Impact of draft side",
	blueSide: "Blue map advantage",
	targetBan: "Rival player’s best champions",
	threatBan: "Threat to the team",
	lookahead: "Impact of the expected reply",
};

const byWeight = (components: Decision["components"]) =>
	[...components].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

// #407: one entry per decision, newest first, readable at a glance.
test("shows each rival decision with portrait, role, player and reasons by weight", async () => {
	vi.spyOn(crypto, "getRandomValues").mockReturnValue(new Uint32Array([7]));
	const user = userEvent.setup();
	const core = await renderWithDraftCore(
		<DraftSessionProvider>
			<ManualDraft />
		</DraftSessionProvider>,
		"en-US",
		undefined,
		namedDraft,
	);
	// Forge's coach considers the likely reply. Forge also has first turn.
	await screen.findByRole("button", { name: "Start series" });
	await user.click(screen.getByRole("combobox", { name: "My team" }));
	await user.click(await screen.findByRole("option", { name: /^Shoal\b/ }));
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await screen.findByText("Waiting for side choice");
	await act(async () => {
		core.act("side.choose", { team: "shoal", choice: "last" });
		core.act("side.choose", { team: "forge", choice: "blue" });
	});
	await screen.findByRole("group", { name: "AI decisions" });
	const decisions: Decision[] = [];
	core.api.subscribe((facts) => {
		for (const raw of facts) {
			const fact = draftFacts.schema.parse(raw);
			if (fact.type === "ai.decided") decisions.unshift(fact);
		}
	});

	expect(panel().hasAttribute("open")).toBe(false);
	await act(async () => {
		for (let turn = 0; turn < 3; turn += 1) {
			core.act("draft.ai", {});
			core.act("draft.ban", { team: "shoal", champion: null });
		}
		core.act("draft.ai", {});
	});

	await user.click(within(panel()).getByText("AI decisions"));
	const [decision, ...earlier] = decisions;
	if (!decision?.champion || decision.action !== "pick" || !decision.reply)
		throw new Error("Expected a pick with a reply after the bans");

	const entries = within(panel())
		.getByRole("list", { name: "Rival decisions, latest first" })
		.querySelectorAll(":scope > li");
	expect([...entries].map((entry) => entry.textContent)).toEqual(
		decisions.map((d) =>
			expect.stringContaining(
				d.champion ? (displayChampion(d.champion) as string) : "Skipped ban",
			),
		),
	);
	const latest = entries[0] as HTMLElement;
	expect(within(latest).getByText("Pick")).toBeTruthy();
	expect(
		within(latest).getByRole("img", {
			name: displayChampion(decision.champion),
		}),
	).toBeTruthy();
	// Forge's first pick goes to its top laner.
	expect(within(latest).getByRole("img", { name: "Top" })).toBeTruthy();
	expect(within(latest).getByText("Emberjaw")).toBeTruthy();

	const ordered = byWeight(decision.components);
	const reasons = within(latest).getByRole("list", { name: "Reasons" });
	expect(
		within(reasons)
			.getAllByRole("listitem")
			.map((item) => item.firstChild?.textContent),
	).toEqual(
		ordered.filter((c) => c.points > 0).map((c) => reasonLabels[c.key]),
	);
	expect(
		within(reasons).getAllByText(/^(High|Medium|Low) weight$/),
	).toHaveLength(ordered.filter((c) => c.points > 0).length);

	const others = within(latest).getByRole("list", { name: "Other options" });
	const items = within(others).getAllByRole("listitem");
	expect(items).toHaveLength(decision.alternatives.length);
	decision.alternatives.forEach(({ champion }, index) => {
		const item = items[index] as HTMLElement;
		expect(
			within(item).getByRole("img", { name: displayChampion(champion) }),
		).toBeTruthy();
		expect(item.textContent).toMatch(
			/Close call|A little behind|Not on its shortlist|Scored as high/,
		);
	});
	expect(
		within(latest).getByText(displayChampion(decision.reply.champion) ?? ""),
	).toBeTruthy();

	const earlierBan = entries[1] as HTMLElement;
	expect(within(earlierBan).getByText("Ban")).toBeTruthy();
	expect(within(earlierBan).queryByRole("img", { name: "Top" })).toBeNull();
	expect(earlier.length).toBe(entries.length - 1);

	// Words and bars only: no fixed-point numbers, percentages or signs.
	const body = panel().querySelector("[data-slot=panel-body]");
	expect(body?.textContent).not.toMatch(/[0-9%+−]/);
});

test("remembers opening and closing the panel across draft sessions", async () => {
	const user = userEvent.setup();
	const first = await renderWithDraftCore(<DraftScreen />);
	await toBoard(user);
	expect(panel().hasAttribute("open")).toBe(false);
	await user.click(within(panel()).getByText("AI decisions"));
	await waitFor(() =>
		expect(
			within(panel()).getByText("The rival has not made a decision yet."),
		).toBeTruthy(),
	);
	first.unmount();

	const second = await renderWithDraftCore(<DraftScreen />);
	await toBoard(user);
	expect(panel().hasAttribute("open")).toBe(true);
	await user.click(within(panel()).getByText("AI decisions"));
	await waitFor(() => expect(panel().hasAttribute("open")).toBe(false));
	second.unmount();

	await renderWithDraftCore(<DraftScreen />);
	await toBoard(user);
	expect(panel().hasAttribute("open")).toBe(false);
});
