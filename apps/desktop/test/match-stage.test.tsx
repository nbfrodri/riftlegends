import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, test } from "vitest";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { draftStages, stageOf } from "../src/renderer/draft/stages";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

// Drive both coaches through the unfinished draft screen using the same session as the UI.
function Series() {
	const { view, options, send, setMine, presentation } = useDraftSession();
	const stage = stageOf(view, presentation);
	useEffect(() => {
		if (!view) {
			setMine("forge");
			void send("series.start", {
				teams: ["forge", "shoal"],
				seeds: [1, 2],
				format: "bo3",
				fearless: "soft",
				timer: false,
				pool: options.pool,
				seed: 7,
				ai: ["coach", "coach"],
			});
		} else if (stage !== "match" && stage !== "result") {
			void send("draft.ai", {});
		}
	}, [view, options, send, setMine, stage]);
	if (stage !== "match" && stage !== "result") return null;
	const Stage = draftStages[stage];
	return (
		<div data-testid="stage" data-stage={stage}>
			<Stage />
		</div>
	);
}

test("plays once, reads game one while the core prepares game two, and continues to result", async () => {
	const { api, sent } = await renderWithDraftCore(
		<DraftSessionProvider>
			<Series />
		</DraftSessionProvider>,
	);
	await screen.findByRole("timer", {}, { timeout: 2500 });
	expect(sent.filter((c) => c.kind === "match.play")).toHaveLength(1);
	expect(
		api.query.mock.calls.some(
			([q]) => q.kind === "match.view" && q.params.game === 1,
		),
	).toBe(true);
	const score = within(screen.getByRole("group", { name: "Series score" }));
	expect(score.getByText("Game 1")).toBeTruthy();
	expect(score.getAllByText("0")).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Skip to end" }));
	fireEvent.click(screen.getByRole("button", { name: "View result" }));
	expect(screen.getByTestId("stage").dataset.stage).toBe("result");
});
