import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { renderWithDraftCore } from "./draft-core";

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
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await screen.findByRole("heading", { level: 1, name: "Side choice" });
}

describe("side choice (U2)", () => {
	test("lets me pick my side when I choose, and says why (game 1 is by seeding)", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await startAs(user, "Forge");
		expect(screen.getByText(/Forge chooses the side/)).toBeTruthy();
		expect(screen.getByText(/seeding/i)).toBeTruthy();

		await user.click(screen.getByRole("radio", { name: "Red side" }));
		await user.click(screen.getByRole("button", { name: "Go to draft" }));

		expect(
			await screen.findByRole("heading", { level: 1, name: "Draft" }),
		).toBeTruthy();
		expect(core.sent.find((c) => c.kind === "side.choose")?.payload).toEqual({
			team: "forge",
			side: "red",
		});
	});

	test("does not wait on the AI: it chooses and the screen shows the side it took", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await startAs(user, "Shoal");
		// Forge has the better seed and is run by the AI.
		expect(await screen.findByText(/Forge chose/)).toBeTruthy();
		expect(core.sent.some((c) => c.kind === "draft.ai")).toBe(true);
		expect(screen.queryByRole("radio", { name: "Red side" })).toBeNull();
		expect(screen.getByText("Blue side").parentElement?.textContent).toContain(
			"Forge",
		);
		expect(screen.getByText("Red side").parentElement?.textContent).toContain(
			"Shoal",
		);

		await user.click(screen.getByRole("button", { name: "Go to draft" }));
		expect(
			await screen.findByRole("heading", { level: 1, name: "Draft" }),
		).toBeTruthy();
	});
});
