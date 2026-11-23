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

function decisionLabel(decision: Decision) {
	if (!decision.champion) return "Skipped ban";
	const verb = decision.action === "pick" ? "Picked" : "Banned";
	return `${verb} ${displayChampion(decision.champion)}`;
}

// Exercise the board with the real core while the test controls turn timing.
function ManualDraft() {
	const { mine, view } = useDraftSession();
	const Setup = draftStages.setup;
	if (!view || !mine) return <Setup />;
	if (view.phase === "side") return <p>Waiting for side choice</p>;
	return <DraftBoard />;
}

test("explains the latest rival decision and keeps earlier decisions newest first", async () => {
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
	if (!decision?.reply || !earlier[0])
		throw new Error("Expected a pick with a reply after the bans");
	const latest = within(panel()).getByRole("region", {
		name: decisionLabel(decision),
	});
	expect(within(latest).getByText(/Total score/)).toBeTruthy();
	const factors = within(latest).getByRole("table", {
		name: "Scoring factors",
	});
	expect(
		within(factors).getAllByText(/points in favor/).length,
	).toBeGreaterThan(0);
	const alternatives = within(latest).getByRole("table", {
		name: "Other options",
	});
	expect(
		within(alternatives)
			.getAllByRole("cell")
			.map((cell) => cell.textContent),
	).toEqual(decision.alternatives.map(({ chance }) => `${chance / 100}%`));
	expect(
		within(latest).getByText(
			`Expected reply · ${displayChampion(decision.reply.champion)}`,
		),
	).toBeTruthy();

	const history = within(panel()).getByRole("list", {
		name: "Earlier decisions",
	});
	expect(
		within(history)
			.getAllByRole("listitem")
			.map((item) => item.textContent),
	).toEqual(
		earlier.map((decision) => expect.stringContaining(decisionLabel(decision))),
	);
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
