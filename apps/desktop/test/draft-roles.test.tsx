import {
	CONTRACT_VERSION,
	type DraftView,
	ROLES,
} from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, expect, test } from "vitest";
import { RolesScreen } from "../src/renderer/draft/roles-screen";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { namedDraft, renderWithDraftCore } from "./draft-core";

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
