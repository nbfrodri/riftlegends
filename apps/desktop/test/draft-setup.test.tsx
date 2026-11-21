import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import type { CoreCommand } from "../src/shared/bridge";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

const checked = (name: string) =>
	(screen.getByRole("radio", { name }) as HTMLInputElement).checked;

async function pickClub(
	user: ReturnType<typeof userEvent.setup>,
	label: string,
	club: string,
) {
	await user.click(screen.getByRole("combobox", { name: label }));
	await user.click(await screen.findByRole("option", { name: club }));
}

describe("series setup (U1)", () => {
	test("offers the two teams, Bo3, fearless hard and the timer off by default", async () => {
		await renderWithDraftCore(<DraftScreen />);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Set up series" }),
		).toBeTruthy();
		expect(
			screen.getByRole("combobox", { name: "My team" }).textContent,
		).toContain("Forge");
		expect(
			screen.getByRole("combobox", { name: "Rival team" }).textContent,
		).toContain("Shoal");
		expect(checked("Bo3")).toBe(true);
		expect(checked("Hard")).toBe(true);
		expect(checked("Off")).toBe(true);
	});

	test("shows the rival coach as information, not as a setting", async () => {
		await renderWithDraftCore(<DraftScreen />);
		const coach = await screen.findByRole("complementary", {
			name: "Rival staff",
		});
		expect(within(coach).getByText("Iko Rhane")).toBeTruthy();
		expect(within(coach).getByText("Counterpick")).toBeTruthy();
		expect(within(coach).getByText("2.2 / 5")).toBeTruthy();
		expect(within(coach).queryAllByRole("combobox")).toHaveLength(0);
		expect(within(coach).queryAllByRole("radio")).toHaveLength(0);
	});

	test("never lets the same team be on both sides: choosing the rival's team swaps them", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await screen.findByRole("heading", { level: 1, name: "Set up series" });
		await pickClub(user, "My team", "Shoal");
		expect(
			screen.getByRole("combobox", { name: "My team" }).textContent,
		).toContain("Shoal");
		expect(
			screen.getByRole("combobox", { name: "Rival team" }).textContent,
		).toContain("Forge");
		expect(
			within(
				screen.getByRole("complementary", { name: "Rival staff" }),
			).getByText("Marlen Voss"),
		).toBeTruthy();
	});

	test("starts the series with the chosen rules and the rival on its coach's AI", async () => {
		const user = userEvent.setup();
		const core = await renderWithDraftCore(<DraftScreen />);
		await screen.findByRole("heading", { level: 1, name: "Set up series" });
		await user.click(screen.getByRole("radio", { name: "Bo1" }));
		await user.click(screen.getByRole("radio", { name: "Soft" }));
		await user.click(screen.getByRole("button", { name: "Start series" }));

		expect(
			await screen.findByRole("heading", { level: 1, name: "Side choice" }),
		).toBeTruthy();
		const start = core.sent.find(
			(c) => c.kind === "series.start",
		) as CoreCommand;
		expect(start).toBeDefined();
		expect(start).toMatchObject({
			expectedPosition: 0,
			payload: {
				teams: ["forge", "shoal"],
				format: "bo1",
				fearless: "soft",
				timer: false,
				ai: [null, "coach"],
			},
		});
		const { pool } = start.payload as { pool: string[] };
		expect(pool.length).toBeGreaterThanOrEqual(40);
	});

	test("stays on the setup and explains when the packaged pool is too small", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await screen.findByRole("heading", { level: 1, name: "Set up series" });
		await user.click(screen.getByRole("radio", { name: "Bo5" }));
		await user.click(screen.getByRole("button", { name: "Start series" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(
			/not enough champions/,
		);
		expect(
			screen.getByRole("heading", { level: 1, name: "Set up series" }),
		).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "Start series",
				}) as HTMLButtonElement
			).disabled,
		).toBe(false);
	});

	test("is translated to Spanish", async () => {
		await renderWithDraftCore(<DraftScreen />, "es-ES");
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Configurar serie",
			}),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Empezar serie" })).toBeTruthy();
		expect(checked("Apagado")).toBe(true);
		expect(screen.getByText("Contraelección")).toBeTruthy();
	});
});
