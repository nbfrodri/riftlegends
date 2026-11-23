import { CONTRACT_VERSION, type MatchView } from "@rift-legends/contracts";
import { cleanup, configure, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { PageHeader } from "../src/renderer/draft/page-header";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { draftStages, stageOf } from "../src/renderer/draft/stages";
import { TurnControls } from "../src/renderer/draft/turn-controls";
import { namedDraft, renderWithDraftCore, seedNextSeries } from "./draft-core";

// The fearless test plays a whole game with the real core.
configure({ asyncUtilTimeout: 10000 });
vi.setConfig({ testTimeout: 20000 });

afterEach(cleanup);

async function startAs(
	user: ReturnType<typeof userEvent.setup>,
	team: "Forge" | "Shoal",
) {
	await screen.findByRole("heading", { level: 1, name: "Set up series" });
	if (team === "Shoal") {
		await user.click(screen.getByRole("combobox", { name: "My team" }));
		await user.click(await screen.findByRole("option", { name: /^Shoal\b/ }));
	}
	seedNextSeries(team === "Forge" ? 7 : 0);
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await screen.findByRole("heading", { level: 1, name: "Side choice" });
}

describe("side choice (U2)", () => {
	test("the draw winner can claim first pick and the opponent chooses the map side", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await startAs(user, "Forge");
		expect(screen.getByText(/Forge won the draw/)).toBeTruthy();
		expect(screen.getAllByRole("radio")).toHaveLength(4);
		await user.click(screen.getByRole("radio", { name: "First pick" }));
		await user.click(screen.getByRole("button", { name: "Confirm choice" }));
		await screen.findByRole("button", { name: "Go to draft" });
		const choices = within(
			screen.getByRole("list", { name: "Decisions" }),
		).getAllByRole("listitem");
		expect(choices[0]?.textContent).toContain("Forge");
		expect(choices[0]?.textContent).toContain("First pick");
		expect(choices[1]?.textContent).toMatch(/Shoal.*(Blue|Red) side/);
		expect(core.sent.find((c) => c.kind === "side.choose")?.payload).toEqual({
			team: "forge",
			choice: "first",
		});
		expect(screen.getByText(/Coach's reason/)).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Go to draft" }));
		const side = choices[1]?.textContent?.includes("Blue side")
			? "Red"
			: "Blue";
		expect(
			within(
				await screen.findByRole("region", { name: `${side} side Forge` }),
			).getByText("First pick"),
		).toBeTruthy();
		expect(screen.getByText(`First pick · ${side}`)).toBeTruthy();
	});

	test("shows the series format and its fearless rule", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await startAs(user, "Forge");

		const series = screen.getByRole("region", { name: "Series" });
		expect(within(series).getByText("Bo3")).toBeTruthy();
		expect(within(series).getByText("First to 2 games")).toBeTruthy();
		expect(within(series).getByText("Hard")).toBeTruthy();
		const history = within(series).getByRole("table", { name: "Series recap" });
		expect(
			within(history).getByRole("row", { name: /Game 1 Choosing sides/ }),
		).toBeTruthy();
		expect(within(history).queryByRole("img", { name: "Winner" })).toBeNull();
		// Game 1: nothing is locked yet.
		expect(
			screen.queryByRole("region", { name: "Locked champions" }),
		).toBeNull();
	});

	test("when the rival wins the draw the user gets only the remaining decision", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await startAs(user, "Shoal");
		const radios = await screen.findAllByRole("radio");
		expect(radios).toHaveLength(2);
		const first = within(
			screen.getByRole("list", { name: "Decisions" }),
		).getAllByRole("listitem")[0];
		expect(first?.textContent).toContain("Forge");
		const remaining = first?.textContent?.includes("side")
			? ["First pick", "Last pick"]
			: ["Blue side", "Red side"];
		for (const name of remaining)
			expect(screen.getByRole("radio", { name })).toBeTruthy();
		await user.click(radios[1] as HTMLElement);
		await user.click(screen.getByRole("button", { name: "Confirm choice" }));
		await screen.findByRole("button", { name: "Go to draft" });
		const history = screen.getByRole("table", { name: "Series recap" });
		expect(
			within(history).getByRole("img", { name: "Chose side" }),
		).toBeTruthy();
	});
});

/** Plays until the requested side choice, then hands control to its chooser. */
function Driver({
	showResult = false,
	stopAt = 2,
	fearless = "hard",
}: {
	showResult?: boolean;
	stopAt?: number;
	fearless?: "hard" | "off";
}) {
	const { view, options, send, setMine, mine, present, presentation } =
		useDraftSession();
	const busy = useRef(false);
	useEffect(() => {
		if (busy.current || mine) return;
		busy.current = true;
		const step = async () => {
			if (!view) {
				const [a, b] = options.teams.map((team) => team.id);
				await send("series.start", {
					teams: [a, b],
					format: "bo5",
					fearless,
					timer: false,
					pool: options.pool,
					seed: 7,
					ai: ["coach", "coach"],
				});
			} else if (view.phase === "result") {
				if (presentation !== "match") present("match");
				else await send("match.play", {});
			} else if (view.phase === "side" && view.turn) {
				if (view.game < stopAt) {
					await send("side.choose", {
						team: view.turn.team,
						choice: view.choices.length
							? view.game === 1
								? "first"
								: "last"
							: view.game === 1
								? "red"
								: "blue",
					});
				} else {
					present(showResult ? "result" : null);
					setMine(view.turn.team);
				}
			} else {
				await send("draft.ai", {});
			}
			busy.current = false;
		};
		void step();
	});
	return null;
}

function Flow() {
	const { view, presentation, mine } = useDraftSession();
	if (!mine) return null;
	const stage = stageOf(view, presentation);
	const Stage = draftStages[stage];
	return (
		<>
			<PageHeader stage={stage}>
				{stage === "side" && <TurnControls />}
			</PageHeader>
			<Stage />
		</>
	);
}

test("shows game 2 in series order until its sides are chosen", async () => {
	const user = userEvent.setup();
	await renderWithDraftCore(
		<DraftSessionProvider>
			<Driver showResult />
			<Flow />
		</DraftSessionProvider>,
	);

	const score = await screen.findByRole("group", { name: "Series score" });
	const { getByText } = within(score);
	expect(getByText("Game 1")).toBeTruthy();
	expect(score.textContent).toContain("Shoal1 – 0Forge");
	expect(getByText("Shoal").classList.contains("text-side-blue")).toBe(true);
	expect(getByText("Forge").classList.contains("text-side-red")).toBe(true);

	await user.click(await screen.findByRole("button", { name: "Next game" }));
	expect(getByText("Game 2")).toBeTruthy();
	expect(score.textContent).toContain("Forge0 – 1Shoal");
	expect(getByText("Forge").className).not.toMatch(/text-side-(blue|red)/);
	expect(getByText("Shoal").className).not.toMatch(/text-side-(blue|red)/);

	await user.click(screen.getByRole("radio", { name: "Blue side" }));
	await user.click(screen.getByRole("button", { name: "Confirm choice" }));
	await user.click(await screen.findByRole("button", { name: "Go to draft" }));
	await screen.findByRole("heading", { level: 1, name: "Draft" });

	expect(score.textContent).toContain("Forge0 – 1Shoal");
	expect(getByText("Forge").classList.contains("text-side-blue")).toBe(true);
	expect(getByText("Shoal").classList.contains("text-side-red")).toBe(true);
});

test("keeps both sides, the chooser and the winner for each map with fearless off", async () => {
	const core = await renderWithDraftCore(
		<DraftSessionProvider>
			<Driver stopAt={3} fearless="off" />
			<Flow />
		</DraftSessionProvider>,
	);
	// Wait for game 3's side choice: the table only then holds games 1 and 2.
	await screen.findByRole("row", { name: /Game 3 Choosing sides/ });
	const history = screen.getByRole("table", { name: "Series recap" });
	expect(
		within(history)
			.getAllByRole("columnheader")
			.map((th) => th.textContent),
	).toEqual(["Map", "Blue", "Red"]);
	for (const game of [1, 2]) {
		const result = await core.api.query({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId: 1,
			params: { game },
		});
		if (!result.ok) throw new Error(JSON.stringify(result));
		const facts = (result.view as MatchView).facts;
		const started = facts.find((fact) => fact.type === "match.started");
		const ended = facts.find((fact) => fact.type === "match.ended");
		if (!started || !ended) throw new Error("missing game");
		const row = await within(history).findByRole("row", {
			name: new RegExp(`Game ${game}`),
		});
		const cells = within(row).getAllByRole("cell");
		for (const [index, side] of (["blue", "red"] as const).entries()) {
			const cell = within(cells[index] as HTMLElement);
			expect(
				cell.getByText(started[side] === "forge" ? "Forge" : "Shoal"),
			).toBeTruthy();
			expect(Boolean(cell.queryByRole("img", { name: "Winner" }))).toBe(
				started[side] === ended.winner,
			);
			expect(Boolean(cell.queryByRole("img", { name: "Chose side" }))).toBe(
				side === (game === 1 ? "red" : "blue"),
			);
		}
	}
	expect(
		within(history).getByRole("row", { name: /Game 3 Choosing sides/ }),
	).toBeTruthy();
});

describe("side choice with fearless", () => {
	test("shows the champions each team played, greyed, before game 2", async () => {
		const core = await renderWithDraftCore(
			<DraftSessionProvider>
				<Driver />
				<Flow />
			</DraftSessionProvider>,
			"en-US",
			undefined,
			namedDraft,
		);
		const locked = await screen.findByRole("region", {
			name: "Locked champions",
		});
		const result = await core.api.query({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId: 1,
			params: { game: 1 },
		});
		if (!result.ok) throw new Error(JSON.stringify(result));
		const ended = (result.view as MatchView).facts.find(
			(f) => f.type === "match.ended",
		);
		if (ended?.type !== "match.ended") throw new Error("no match.ended");

		for (const team of ["Forge", "Shoal"]) {
			const list = within(locked).getByRole("list", {
				name: `Played by ${team}`,
			});
			const played = ended.players
				.filter((p) => p.team === team.toLowerCase())
				.map(
					(p) => namedDraft.champions.find((c) => c.id === p.champion)?.name,
				);
			expect(await within(list).findAllByRole("listitem")).toHaveLength(5);
			for (const name of played) {
				expect(within(list).getByText(name as string)).toBeTruthy();
			}
		}
		expect(screen.getByText(/lost the last game/)).toBeTruthy();
	});
});
