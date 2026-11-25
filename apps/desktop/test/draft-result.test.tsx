import {
	CONTRACT_VERSION,
	type MatchView,
	type SeriesSummary,
} from "@rift-legends/contracts";
import { packagedDraftContent } from "@rift-legends/core";
import {
	cleanup,
	configure,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
	DraftSessionProvider,
	useDraftSession,
} from "../src/renderer/draft/session";
import { draftStages, stageOf } from "../src/renderer/draft/stages";
import { namedDraft, renderWithDraftCore } from "./draft-core";

// Each test plays whole games with the real core, which takes longer when the suite runs in parallel.
configure({ asyncUtilTimeout: 10000 });
vi.setConfig({ testTimeout: 20000 });

afterEach(cleanup);

/**
 * Plays a series with the real core (AI on both sides) until the first game is
 * over (`game1`) or the series is (`over`), then shows the result, as the match
 * screen will.
 */
function Driver({ stop }: { stop: "game1" | "over" }) {
	const { view, options, send, setMine, present, presentation } =
		useDraftSession();
	const busy = useRef(false);
	useEffect(() => {
		// The session remounts on "New series", so the driver's memory lives
		// outside it: once the series is over, the user drives.
		if (busy.current || control.finished) return;
		busy.current = true;
		const step = async () => {
			if (!view) {
				const [a, b] = options.teams.map((team) => team.id);
				const ok = await send("series.start", {
					teams: [a, b],
					format: "bo3",
					fearless: "off",
					timer: false,
					pool: options.pool,
					seed: 7,
					ai: ["coach", "coach"],
				});
				if (ok) setMine(a as string);
			} else if (view.phase === "over") {
				control.finished = true;
				if (presentation !== "result") present("result");
			} else if (view.phase === "result") {
				// The match screen shows itself over the core's phase, then the result.
				if (presentation !== "match") present("match");
				else await send("match.play", {});
			} else if (view.phase === "side") {
				if (stop === "game1" && view.game === 2) {
					if (presentation === "match") present("result");
				} else if (view.turn) {
					await send("side.choose", {
						team: view.turn.team,
						choice: view.choices.length ? "last" : "blue",
					});
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
	const { view, presentation } = useDraftSession();
	const Stage = draftStages[stageOf(view, presentation)];
	return <Stage />;
}

/** Shared by the driver across remounts of the session. */
const control = { finished: false };

function renderResult(stop: "game1" | "over") {
	control.finished = false;
	return renderWithDraftCore(
		<DraftSessionProvider>
			<Driver stop={stop} />
			<Flow />
		</DraftSessionProvider>,
		"en-US",
		undefined,
		namedDraft,
	);
}

type Core = Awaited<ReturnType<typeof renderResult>>;

const ask = async <T,>(core: Core, kind: string, params: object) => {
	const result = await core.api.query({
		v: CONTRACT_VERSION,
		kind,
		sessionId: 1,
		params,
	});
	if (!result.ok) throw new Error(JSON.stringify(result));
	return result.view as T;
};

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support"];
const handleOf = (id: string) =>
	packagedDraftContent.players.find((p) => p.id === id)?.handle;
const capital = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const grouped = (n: number) => n.toLocaleString("en-US");

describe("game result (U9)", () => {
	test("shows the winner and every player's stats from match.view", async () => {
		const core = await renderResult("game1");
		const table = await screen.findByRole("table", { name: "Map 1 stats" });
		for (const name of ["K/D/A", "Gold", "Damage"]) {
			expect(
				within(table)
					.getByRole("columnheader", { name })
					.querySelector("svg")
					?.getAttribute("width"),
			).toBe("18");
		}
		const match = await ask<MatchView>(core, "match.view", { game: 1 });
		const ended = match.facts.find((f) => f.type === "match.ended");
		if (ended?.type !== "match.ended") throw new Error("no match.ended");

		expect(
			screen.getByText(`Victory for ${capital(ended.winner)}`),
		).toBeTruthy();
		const rows = within(table).getAllByRole("row").slice(1);
		expect(rows).toHaveLength(10);
		ended.players.forEach((p, i) => {
			const row = rows[i] as HTMLElement;
			expect(within(row).getByRole("rowheader").textContent).toBe(
				handleOf(p.player),
			);
			const name = namedDraft.champions.find((c) => c.id === p.champion)?.name;
			if (!name) throw new Error(`Unknown champion: ${p.champion}`);
			expect(within(row).getByRole("cell", { name })).toBeTruthy();
			expect(
				within(row)
					.getAllByRole("cell")
					.slice(1)
					.map((c) => c.textContent),
			).toEqual([
				`${p.kills}/${p.deaths}/${p.assists}`,
				grouped(p.gold),
				grouped(p.damage),
				`${Math.round(p.participation / 100)} %`,
				String(p.rating),
			]);
		});
	});

	test("a decisive objective shows its icon next to its title", async () => {
		const core = await renderResult("game1");
		const real = core.api.query.getMockImplementation();
		core.api.query.mockImplementation(async (query) => {
			const answer = (await real?.(query)) as { ok: boolean; view: MatchView };
			if (query.kind === "match.view" && answer.ok) {
				for (const fact of answer.view.facts) {
					if (fact.type === "match.event") fact.kind = "baron";
				}
			}
			return answer as never;
		});
		const list = await screen.findByRole("list", { name: "Decisive disputes" });
		for (const item of within(list).getAllByRole("listitem")) {
			expect(item.textContent).toContain("Baron for");
			expect(item.querySelector("h3 svg")).toBeTruthy();
		}
	});

	test("lists the decisive disputes with their causes in words, and unknown keys as they are", async () => {
		const core = await renderResult("game1");
		const real = core.api.query.getMockImplementation();
		core.api.query.mockImplementation(async (query) => {
			const answer = (await real?.(query)) as {
				ok: boolean;
				view: MatchView;
			};
			if (query.kind === "match.view" && answer.ok) {
				for (const fact of answer.view.facts) {
					if (fact.type === "match.event") {
						fact.causes = [
							{ key: "zzz-unknown", points: 99999 },
							{ key: "teamfight", points: 88888 },
						];
					}
				}
			}
			return answer as never;
		});
		const list = await screen.findByRole("list", {
			name: "Decisive disputes",
		});
		const items = within(list).getAllByRole("listitem");
		expect(items.length).toBeGreaterThan(0);
		expect(items.length).toBeLessThanOrEqual(3);
		// The decisive disputes are the winner's, read by index from match.view.
		const match = await ask<MatchView>(core, "match.view", { game: 1 });
		const ended = match.facts.find((f) => f.type === "match.ended");
		const winner = capital(ended?.type === "match.ended" ? ended.winner : "");
		for (const item of items) {
			expect(item.textContent).toContain(winner);
			expect(within(item).getByText(/^\d+:\d{2}$/)).toBeTruthy();
			expect(item.textContent).toContain("zzz-unknown");
			expect(item.textContent).toContain("better teamfighting");
		}
	});

	test("says who leads each role and by how much, highlighting gaps only over the threshold", async () => {
		const core = await renderResult("game1");
		const table = await screen.findByRole("table", {
			name: "Differences by role",
		});
		const summary = await ask<SeriesSummary>(core, "series.summary", {});
		const lines = summary.lanes[0]?.lines ?? [];
		// The table can show before its rows load.
		const rows = await waitFor(() => {
			const found = within(table).getAllByRole("row").slice(1);
			expect(found).toHaveLength(5);
			return found;
		});
		lines.forEach((line, i) => {
			const row = rows[i] as HTMLElement;
			expect(row.getAttribute("data-gap")).toBe(String(line.gap));
			const points = Math.abs(line.rating);
			expect(row.textContent).toContain(
				line.rating === 0
					? "Even"
					: `${points} ${points === 1 ? "point" : "points"} above`,
			);
			expect(row.textContent).toContain(
				line.gold === 0
					? "Even"
					: `${grouped(Math.abs(line.gold))} gold more than`,
			);
			expect(row.textContent).not.toMatch(/[+−]\d/);
			expect(points > 15).toBe(line.gap);
		});
		const gaps = lines.flatMap((l, i) => (l.gap ? [ROLES[i]] : []));
		if (gaps.length > 0) {
			expect(screen.getByText(/^Big difference in /).textContent).toContain(
				gaps[0] as string,
			);
		} else {
			expect(screen.getByText("No big differences")).toBeTruthy();
		}
	});

	test("continues to the next game", async () => {
		const user = userEvent.setup();
		await renderResult("game1");
		await screen.findByRole("button", { name: "Next game" });
		expect(screen.queryByRole("button", { name: "New series" })).toBeNull();
		await user.click(await screen.findByRole("button", { name: "Next game" }));
		expect(await screen.findByText(/lost the last game/)).toBeTruthy();
	});
});

describe("series result (U10)", () => {
	test("has a tab per played map and moves between them with the keyboard", async () => {
		const user = userEvent.setup();
		const core = await renderResult("over");
		const full = await screen.findByRole("tab", { name: "Full series" });
		const maps = (await ask<SeriesSummary>(core, "series.summary", {})).lanes
			.length;
		expect(screen.getAllByRole("tab")).toHaveLength(maps + 1);
		expect(full.getAttribute("aria-selected")).toBe("true");

		full.focus();
		await user.keyboard("{ArrowRight}");
		const first = screen.getByRole("tab", { name: "Map 1" });
		expect(first.getAttribute("aria-selected")).toBe("true");
		expect(document.activeElement).toBe(first);
		expect(
			await screen.findByRole("table", { name: "Map 1 stats" }),
		).toBeTruthy();

		await user.keyboard("{End}");
		expect(
			screen
				.getByRole("tab", { name: `Map ${maps}` })
				.getAttribute("aria-selected"),
		).toBe("true");
		await user.keyboard("{Home}");
		expect(full.getAttribute("aria-selected")).toBe("true");
	});

	test("shows the winner and the MVP with their numbers", async () => {
		const core = await renderResult("over");
		await screen.findByRole("tab", { name: "Full series" });
		const mvp = (await ask<SeriesSummary>(core, "series.summary", {})).mvp;
		if (!mvp) throw new Error("no mvp");

		const panel = await screen.findByRole("region", { name: "Series MVP" });
		for (const id of mvp.champions) {
			expect(panel.textContent).toContain(
				namedDraft.champions.find((c) => c.id === id)?.name,
			);
		}
		expect(panel.textContent).toContain(capital(mvp.team));
		expect(panel.textContent).toContain(handleOf(mvp.player));
		expect(panel.textContent).toContain(String(mvp.rating / 10));
		expect(panel.textContent).toContain(
			`${mvp.kills}/${mvp.deaths}/${mvp.assists}`,
		);
		expect(panel.textContent).toContain(
			`${Math.round(mvp.participation / 100)} %`,
		);
		expect(screen.getByText("Series winner")).toBeTruthy();
	});

	test("recaps the maps and opens each one from a View button (#376: no arrow icon)", async () => {
		const user = userEvent.setup();
		await renderResult("over");
		await screen.findByRole("tab", { name: "Full series" });
		const recap = await screen.findByRole("table", { name: "Series recap" });
		expect(within(recap).getAllByRole("row").length).toBeGreaterThan(2);
		const button = within(recap).getByRole("button", { name: "View map 1" });
		expect(button.textContent).toBe("View");
		expect(button.querySelector("svg")).toBeNull();
		await user.click(button);
		expect(
			screen.getByRole("tab", { name: "Map 1" }).getAttribute("aria-selected"),
		).toBe("true");
	});

	test("offers no next game, and New series goes back to the setup", async () => {
		const user = userEvent.setup();
		await renderResult("over");
		await screen.findByRole("tab", { name: "Full series" });
		expect(screen.queryByRole("button", { name: "Next game" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "New series" }));
		expect(
			await screen.findByRole("button", { name: "Start series" }),
		).toBeTruthy();
	});
});
