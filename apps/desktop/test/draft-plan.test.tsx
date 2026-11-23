import type { AssetStatus } from "@rift-legends/contracts";
import {
	CONTRACT_VERSION,
	type MatchPlan,
	ROLES,
} from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { draftStages, stageOf } from "../src/renderer/draft/stages";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

/** Starts a series with the user on Forge and a coach on Shoal and drafts until the plan stage. */
function Driver() {
	const { view, options, send, setMine } = useDraftSession();
	const busy = useRef(false);
	useEffect(() => {
		if (busy.current) return;
		busy.current = true;
		const step = async () => {
			if (!view) {
				const ok = await send("series.start", {
					teams: ["forge", "shoal"],
					format: "bo1",
					fearless: "soft",
					timer: false,
					pool: options.pool,
					seed: 7,
					ai: [null, "coach"],
				});
				if (ok) setMine("forge");
			} else if (view.phase === "roles" && view.turn?.team === "forge") {
				const picks =
					view.blue.team === "forge" ? view.blue.picks : view.red.picks;
				const lineup = Object.fromEntries(
					ROLES.map((role, i) => [role, picks[i]]),
				);
				await send("draft.roles", { team: "forge", roles: lineup });
			} else if (view.phase === "side" && view.turn?.team === "forge") {
				await send("side.choose", { team: "forge", choice: "blue" });
			} else if (view.phase !== "result") {
				const turn = view.turn;
				if (turn?.team !== "forge") await send("draft.ai", {});
				else if (turn.action === "ban")
					await send("draft.ban", { team: "forge", champion: null });
				else {
					const free = view.availability.find((a) => a.status === "free");
					await send("draft.pick", { team: "forge", champion: free?.champion });
				}
			}
			busy.current = false;
		};
		void step();
	});
	return null;
}

function Flow() {
	const { view, presentation } = useDraftSession();
	const stage = stageOf(view, presentation);
	const Stage = draftStages[stage];
	return (
		<div data-stage={stage} data-testid="stage">
			{(stage === "plan" || stage === "match") && <Stage />}
		</div>
	);
}

const render = (assets: AssetStatus = { state: "missing" }) =>
	renderWithDraftCore(
		<AssetsProvider api={fakeAssets(assets).api}>
			<DraftSessionProvider>
				<Driver />
				<Flow />
			</DraftSessionProvider>
		</AssetsProvider>,
	);

type Core = Awaited<ReturnType<typeof render>>;

const suggestion = async (core: Core) => {
	const result = await core.api.query({
		v: CONTRACT_VERSION,
		kind: "match.plan",
		sessionId: 1,
		params: {},
	});
	if (!result.ok) throw new Error(JSON.stringify(result));
	return result.view as MatchPlan;
};

const label = {
	tempo: { slow: "Slow", balanced: "Balanced", fast: "Fast" },
	objectives: { dragon: "Dragons", balanced: "Balanced", baron: "Baron" },
	risk: { safe: "Safe", balanced: "Balanced", risky: "Risky" },
} as const;
const group = {
	tempo: "Tempo",
	objectives: "Objectives",
	risk: "Risk",
} as const;
const choice = (lever: keyof typeof group) =>
	within(screen.getByRole("radiogroup", { name: group[lever] }));
const checked = (lever: keyof typeof group) =>
	(choice(lever).getAllByRole("radio") as HTMLInputElement[])
		.filter((radio) => radio.checked)
		.map((radio) => radio.value);
const play = () => screen.getByRole("button", { name: "Play" });

describe("game plan (U12)", () => {
	test("is the stage between roles and the match", async () => {
		await render();
		await screen.findByRole("button", { name: "Play" });
		expect(screen.getByTestId("stage").dataset.stage).toBe("plan");
	});

	test("preselects the core's suggestion, marks it and explains it", async () => {
		const core = await render();
		await screen.findByRole("button", { name: "Play" });
		const plan = await suggestion(core);
		for (const lever of ["tempo", "objectives", "risk"] as const) {
			expect(checked(lever)).toEqual([plan.strategy[lever]]);
			const radio = choice(lever).getByRole("radio", {
				name: new RegExp(label[lever][plan.strategy[lever] as never]),
			});
			expect(radio.closest("label")?.textContent).toContain("Suggested");
			expect(choice(lever).getAllByText("Suggested")).toHaveLength(1);
		}
		expect(screen.getByText("Why this plan")).toBeTruthy();
		expect(screen.getAllByRole("listitem").length).toBe(plan.causes.length);
		// Every reason is a sentence, not a raw key.
		for (const item of screen.getAllByRole("listitem")) {
			expect(item.textContent).not.toMatch(/^(tempo|objectives|risk)\./);
		}
	});

	test("dragon and baron show their official icons, or the own ones without the cache", async () => {
		const option = (name: string) =>
			choice("objectives")
				.getByRole("radio", { name: new RegExp(`^${name}`) })
				.closest("label");
		const view = await render({ state: "ready", version: "16.23" });
		await screen.findByRole("button", { name: "Play" });
		for (const [name, path] of [
			["Dragons", "objectives/dragon.png"],
			["Baron", "objectives/baron.png"],
		] as const) {
			const image = await within(option(name) as HTMLElement).findByRole(
				"presentation",
				{ hidden: true },
			);
			expect(image.getAttribute("src")).toBe(`rift-asset://cdragon/${path}`);
		}
		view.unmount();
		await render();
		await screen.findByRole("button", { name: "Play" });
		for (const name of ["Dragons", "Baron"]) {
			expect(option(name)?.querySelector("img")).toBeNull();
			expect(option(name)?.querySelector("svg.lucide")).toBeTruthy();
		}
	});

	test("Play without changes sends the suggestion and shows the match", async () => {
		const user = userEvent.setup();
		const core = await render();
		await screen.findByRole("button", { name: "Play" });
		const plan = await suggestion(core);
		await user.click(play());
		await screen.findByRole("timer", {}, { timeout: 2500 });
		const sent = core.sent.filter((c) => c.kind === "match.play");
		expect(sent).toHaveLength(1);
		expect(sent[0]?.payload).toEqual({ strategy: plan.strategy });
		expect(screen.getByTestId("stage").dataset.stage).toBe("match");
	});

	test("a changed lever is what match.play sends", async () => {
		const user = userEvent.setup();
		const core = await render();
		await screen.findByRole("button", { name: "Play" });
		const plan = await suggestion(core);
		const other = plan.strategy.tempo === "slow" ? "fast" : "slow";
		await user.click(
			choice("tempo").getByRole("radio", {
				name: new RegExp(label.tempo[other]),
			}),
		);
		expect(checked("tempo")).toEqual([other]);
		await user.click(play());
		await screen.findByRole("timer", {}, { timeout: 2500 });
		const sent = core.sent.filter((c) => c.kind === "match.play");
		expect(sent[0]?.payload).toEqual({
			strategy: { ...plan.strategy, tempo: other },
		});
	});
});
