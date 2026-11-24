import {
	CONTRACT_VERSION,
	type DraftView,
	ROLES,
} from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { BroadcastScene } from "../src/renderer/draft/broadcast/scene";
import { RolesScreen } from "../src/renderer/draft/roles-screen";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { namedDraft, renderWithDraftCore } from "./draft-core";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

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
					teams: [a, b],
					format: "bo1",
					fearless: "soft",
					timer: false,
					pool: options.pool,
					seed: 7,
					ai: ["coach", "coach"],
				});
				if (ok) setMine(mine);
			} else if (
				view.phase !== "result" &&
				(view.phase !== "roles" || view.turn?.team !== mine)
			) {
				await send("draft.ai", {});
			}
			busy.current = false;
		};
		void step();
	});
	return null;
}

function renderRoles(mine = "shoal") {
	return renderWithDraftCore(
		<DraftSessionProvider>
			<Driver mine={mine} />
			<RolesScreen />
		</DraftSessionProvider>,
		"en-US",
		undefined,
		namedDraft,
	);
}

test("exchanges champions between fixed players and submits the displayed lineup", async () => {
	const user = userEvent.setup();
	const core = await renderRoles();
	const confirm = await screen.findByRole("button", { name: "Confirm lineup" });
	const response = await core.api.query({
		v: CONTRACT_VERSION,
		sessionId: 1,
		kind: "draft.view",
		params: {},
	});
	if (!response.ok) throw new Error("Missing draft");
	const view = response.view as DraftView;
	const mine = view.red;
	const rows = (name: string) =>
		within(screen.getByRole("region", { name })).getAllByRole("article");
	const ownRows = rows("Shoal lineup");
	const rivalRows = rows("Forge lineup");
	const names = (cards: HTMLElement[]) =>
		cards.map((row) =>
			within(row)
				.getByRole("img", { name: /^The Unforgotten/ })
				.getAttribute("aria-label"),
		);
	const label = (id: string) =>
		namedDraft.champions.find((c) => c.id === id)?.name ?? "";
	expect(names(ownRows)).toEqual(mine.picks.map(label));
	expect(names(rivalRows)).toEqual(
		ROLES.map((role) => label(view.blue.roles?.[role] ?? "")),
	);
	expect(screen.queryByRole("combobox")).toBeNull();
	expect(
		rivalRows.every((row) => within(row).queryByRole("button") === null),
	).toBe(true);
	const players = ownRows.map((row) => row.getAttribute("aria-label"));
	const swaps = ownRows.map((row) =>
		within(row).getByRole("button", { name: /^Swap/ }),
	);
	await user.click(swaps[0] as HTMLElement);
	(swaps[1] as HTMLElement).focus();
	await user.keyboard("{Enter}");
	const order = [...mine.picks];
	[order[0], order[1]] = [order[1] as string, order[0] as string];
	expect(names(ownRows)).toEqual(order.map(label));
	expect(
		rows("Shoal lineup").map((row) => row.getAttribute("aria-label")),
	).toEqual(players);
	await user.click(confirm);
	expect(core.sent.at(-1)).toMatchObject({
		kind: "draft.roles",
		payload: {
			team: mine.team,
			roles: Object.fromEntries(ROLES.map((role, i) => [role, order[i]])),
		},
	});
});

const own = () =>
	within(screen.getByRole("region", { name: "Shoal lineup" })).getAllByRole(
		"article",
	);
const championsOf = (rows: HTMLElement[]) =>
	rows.map((row) =>
		within(row)
			.getByRole("img", { name: /^The Unforgotten/ })
			.getAttribute("aria-label"),
	);
const swapButton = (row: HTMLElement) =>
	within(row).getByRole("button", { name: /^Swap/ });

async function pendingOnFirst() {
	const user = userEvent.setup();
	await renderRoles();
	await screen.findByRole("button", { name: "Confirm lineup" });
	const before = championsOf(own());
	await user.click(swapButton(own()[0] as HTMLElement));
	return { user, before };
}

test("after Swap on A, a click anywhere on B swaps them and announces the result", async () => {
	const { user, before } = await pendingOnFirst();
	expect(screen.getByRole("status").textContent).toBe(
		`Choose who swaps with ${before[0]}.`,
	);
	await user.click(within(own()[2] as HTMLElement).getByText(before[2] ?? ""));
	expect(championsOf(own())).toEqual([
		before[2],
		before[1],
		before[0],
		before[3],
		before[4],
	]);
	expect(screen.getByRole("status").textContent).toBe(
		`Swapped ${before[0]} and ${before[2]}.`,
	);
	expect(own().some((row) => row.dataset.swap === "pending")).toBe(false);
});

test("Escape or a second click on A cancels the pending swap", async () => {
	const { user, before } = await pendingOnFirst();
	await user.keyboard("{Escape}");
	expect(own().every((row) => row.dataset.swap === undefined)).toBe(true);
	expect(screen.getByRole("status").textContent).toBe(
		"The lineup is ready to play.",
	);
	await user.click(swapButton(own()[0] as HTMLElement));
	await user.click(own()[0] as HTMLElement);
	expect(own().every((row) => row.dataset.swap === undefined)).toBe(true);
	await user.click(own()[1] as HTMLElement);
	expect(championsOf(own())).toEqual(before);
});

test("with the keyboard, Enter or Space on the other champion completes the swap", async () => {
	const { user, before } = await pendingOnFirst();
	const target = swapButton(own()[3] as HTMLElement);
	expect(target.getAttribute("aria-label")).toBe(`Swap with ${before[3]}`);
	target.focus();
	await user.keyboard(" ");
	expect(championsOf(own())).toEqual([
		before[3],
		before[1],
		before[2],
		before[0],
		before[4],
	]);
});

test("the pending champion pulses and the others are marked as targets", async () => {
	await pendingOnFirst();
	const [first, ...rest] = own();
	expect(first?.dataset.swap).toBe("pending");
	expect(first?.classList.contains("swap-pulse")).toBe(true);
	expect(rest.every((row) => row.dataset.swap === "target")).toBe(true);
	expect(rest.every((row) => row.classList.contains("cursor-pointer"))).toBe(
		true,
	);
});

test("with reduced motion the pending champion keeps a static border", async () => {
	const media = window.matchMedia("(prefers-reduced-motion: reduce)");
	vi.spyOn(media, "matches", "get").mockReturnValue(true);
	vi.spyOn(window, "matchMedia").mockReturnValue(media);
	await pendingOnFirst();
	const first = own()[0];
	expect(first?.dataset.swap).toBe("pending");
	expect(first?.classList.contains("swap-pulse")).toBe(false);
	expect(first?.classList.contains("ring-action")).toBe(true);
});

test("entering Roles shows no notification of the last draft pick", async () => {
	await renderWithDraftCore(
		<DraftSessionProvider>
			<Driver mine="shoal" />
			<BroadcastScene />
			<RolesScreen />
		</DraftSessionProvider>,
		"en-US",
		undefined,
		namedDraft,
	);
	await screen.findByRole("button", { name: "Confirm lineup" });
	expect(document.querySelector("[data-draft-lock]")).toBeNull();
	expect(
		screen.getByRole("status", { name: "Draft confirmation" }).textContent,
	).toBe("");
});

test("every row of both lineups shows the player's photo or its silhouette", async () => {
	await renderRoles();
	await screen.findByRole("button", { name: "Confirm lineup" });
	for (const name of ["Shoal lineup", "Forge lineup"]) {
		const rows = within(screen.getByRole("region", { name })).getAllByRole(
			"article",
		);
		expect(rows).toHaveLength(5);
		for (const row of rows) {
			const handle = row.getAttribute("aria-label")?.split(" · ")[1];
			expect(handle).toBeTruthy();
			within(row).getByRole("img", { name: `Portrait of ${handle}` });
		}
	}
});
