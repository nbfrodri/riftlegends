import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { suggestRoles } from "../src/renderer/draft/roles-proposal";
import { RolesScreen } from "../src/renderer/draft/roles-screen";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

/** Starts a series with the AI on both sides and drafts until the roles phase. */
function Driver({ mine }: { mine: string }) {
	const { view, options, send, setMine } = useDraftSession();
	const busy = useRef(false);
	useEffect(() => {
		if (busy.current) return;
		busy.current = true;
		const step = async () => {
			if (!view) {
				const [a, b] = options.teams.map((team) => team.id);
				const ok = await send("series.start", {
					teams: [mine, mine === a ? b : a],
					seeds: mine === a ? [0, 1] : [1, 0],
					format: "bo1",
					fearless: "soft",
					timer: false,
					pool: options.pool,
					seed: 7,
					ai: ["coach", "coach"],
				});
				if (ok) setMine(mine);
			} else if (view.phase !== "roles" && view.phase !== "result") {
				await send("draft.ai", {});
			}
			busy.current = false;
		};
		void step();
	});
	return null;
}

function renderRoles(mine = "forge") {
	return renderWithDraftCore(
		<DraftSessionProvider>
			<Driver mine={mine} />
			<RolesScreen />
		</DraftSessionProvider>,
	);
}

const cards = () => screen.getAllByRole("article");
const roleOf = (card: HTMLElement) =>
	within(card).getByRole("combobox").textContent?.replace("▼", "") ?? "";
const swapOf = (card: HTMLElement) =>
	within(card).getByRole("button", { name: /Swap/ });
const confirm = () => screen.getByRole("button", { name: "Confirm lineup" });

describe("suggestRoles", () => {
	const positions = {
		a: [{ role: "mid" as const, tier: "S" as const }],
		b: [
			{ role: "mid" as const, tier: "A" as const },
			{ role: "top" as const, tier: "B" as const },
		],
		c: [{ role: "jungle" as const, tier: "A" as const }],
		d: [{ role: "bot" as const, tier: "A" as const }],
		e: [{ role: "support" as const, tier: "A" as const }],
	};

	test("gives each role to the champion that fits it and the rest to what is left", () => {
		expect(suggestRoles(["b", "a", "c", "d", "e"], positions)).toEqual({
			top: "b",
			jungle: "c",
			mid: "a",
			bot: "d",
			support: "e",
		});
	});

	test("on a tie, follows the pick order", () => {
		const flat = Object.fromEntries(
			["a", "b", "c", "d", "e"].map((id) => [
				id,
				(["top", "jungle", "mid", "bot", "support"] as const).map((role) => ({
					role,
					tier: "A" as const,
				})),
			]),
		);
		expect(suggestRoles(["c", "a", "e", "b", "d"], flat)).toEqual({
			top: "c",
			jungle: "a",
			mid: "e",
			bot: "b",
			support: "d",
		});
	});
});

describe("role assignment (U7)", () => {
	test("proposes a valid lineup, one champion per role, with confirm enabled", async () => {
		await renderRoles();
		await screen.findByRole("button", { name: "Confirm lineup" });
		expect(cards()).toHaveLength(5);
		expect(new Set(cards().map(roleOf)).size).toBe(5);
		expect(confirm().hasAttribute("disabled")).toBe(false);
		expect(screen.getByRole("status").textContent).toContain(
			"Five roles assigned",
		);
	});

	test("swaps two champions with the mouse and with the keyboard", async () => {
		const user = userEvent.setup();
		await renderRoles();
		await screen.findByRole("button", { name: "Confirm lineup" });
		const [first, second, third, fourth] = cards() as HTMLElement[];
		const [a, b, c, d] = [first, second, third, fourth].map((card) =>
			roleOf(card as HTMLElement),
		);

		await user.click(swapOf(first as HTMLElement));
		await user.click(swapOf(second as HTMLElement));
		expect([
			roleOf(first as HTMLElement),
			roleOf(second as HTMLElement),
		]).toEqual([b, a]);

		swapOf(third as HTMLElement).focus();
		await user.keyboard("{Enter}");
		swapOf(fourth as HTMLElement).focus();
		await user.keyboard("{Enter}");
		expect([
			roleOf(third as HTMLElement),
			roleOf(fourth as HTMLElement),
		]).toEqual([d, c]);
	});

	test("says what is wrong with a repeated role and blocks confirming", async () => {
		const user = userEvent.setup();
		const core = await renderRoles();
		await screen.findByRole("button", { name: "Confirm lineup" });
		const [first, second] = cards() as HTMLElement[];
		const target = roleOf(second as HTMLElement) as string;
		await user.click(within(first as HTMLElement).getByRole("combobox"));
		await user.click(await screen.findByRole("option", { name: target }));

		const status = screen.getByRole("status");
		expect(status.textContent).toContain(`Repeated: ${target}`);
		expect(status.textContent).toMatch(/Missing: /);
		expect(confirm().getAttribute("aria-disabled") ?? "true").toBe("true");
		await user.click(confirm());
		expect(core.sent.some((c) => c.kind === "draft.roles")).toBe(false);

		await user.click(
			screen.getByRole("button", { name: "Restore suggestion" }),
		);
		expect(screen.getByRole("status").textContent).toContain(
			"Five roles assigned",
		);
	});

	test("sends draft.roles with the lineup on confirm", async () => {
		const user = userEvent.setup();
		const core = await renderRoles();
		await screen.findByRole("button", { name: "Confirm lineup" });
		await user.click(confirm());
		const payload = core.sent.find((c) => c.kind === "draft.roles")
			?.payload as { team: string; roles: Record<string, string> };
		expect(payload.team).toBe("forge");
		expect(Object.keys(payload.roles).sort()).toEqual([
			"bot",
			"jungle",
			"mid",
			"support",
			"top",
		]);
		expect(new Set(Object.values(payload.roles)).size).toBe(5);
	});

	test("shows the rival assigning when it is not my turn", async () => {
		// Blue assigns first; as red I wait for the rival.
		await renderRoles("shoal");
		expect(await screen.findByText(/Forge is assigning roles/)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Confirm lineup" })).toBeNull();
	});
});
