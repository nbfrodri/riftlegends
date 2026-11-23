import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { renderWithDraftCore, seedNextSeries } from "./draft-core";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function start(timer: boolean) {
	const core = await renderWithDraftCore(<DraftScreen />);
	const start = await screen.findByRole("button", { name: "Start series" });
	if (timer) fireEvent.click(screen.getByRole("radio", { name: "On" }));
	seedNextSeries();
	fireEvent.click(start);
	fireEvent.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
	const go = await screen.findByRole("button", { name: "Go to draft" });
	vi.useFakeTimers();
	fireEvent.click(go);
	await advance(10);
	return core;
}

test("times out my ban once, then lets the AI act after its pause", async () => {
	const core = await start(true);
	expect(screen.getByRole("timer").textContent).toContain("00:30");
	await advance(pacing.turnMs - 1000);
	expect(screen.getByRole("timer").textContent).toContain("00:01");
	expect(
		core.sent
			.slice(3)
			.some((c) => c.kind === "draft.ai" || c.kind === "draft.timeout"),
	).toBe(false);
	await advance(1000);
	expect(core.sent.at(-1)?.kind).toBe("draft.timeout");
	await advance(10);
	expect(screen.queryByRole("timer")).toBeNull();
	await advance(pacing.aiPauseMs);
	expect(core.sent.at(-1)?.kind).toBe("draft.ai");
	expect(core.sent.filter((c) => c.kind === "draft.timeout")).toHaveLength(1);
});

test("with the timer off my turn waits, and reduced motion announces both bans immediately", async () => {
	const media = window.matchMedia("(prefers-reduced-motion: reduce)");
	vi.spyOn(media, "matches", "get").mockReturnValue(true);
	vi.spyOn(window, "matchMedia").mockReturnValue(media);
	const core = await start(false);
	await advance(60_000);
	expect(core.sent.map((c) => c.kind)).toEqual([
		"series.start",
		"side.choose",
		"draft.ai",
	]);
	expect(screen.queryByRole("timer")).toBeNull();
	const pool = screen.getByRole("group", { name: "Champions" });
	fireEvent.click(within(pool).getByRole("button", { name: "Cragbell" }));
	fireEvent.click(screen.getByRole("button", { name: "Confirm ban" }));
	await advance(10);
	const live = screen.getByRole("status", { name: "Draft confirmation" });
	expect(live.textContent).toBe("Forge banned Cragbell");
	expect(live.parentElement?.querySelector("strong")?.textContent).toBe(
		"Cragbell",
	);
	expect(live.parentElement?.querySelector("canvas")).toBeNull();
	expect(
		live.parentElement?.getAnimations?.({ subtree: true }) ?? [],
	).toHaveLength(0);
	await advance(pacing.aiPauseMs);
	expect(live.textContent).toMatch(/^Shoal banned /);
	await advance(60_000);
	expect(core.sent.map((c) => c.kind)).toEqual([
		"series.start",
		"side.choose",
		"draft.ai",
		"draft.ban",
		"draft.ai",
	]);
});

test("confirming just before the deadline cancels that timeout on the rival's turn", async () => {
	const core = await start(true);
	await advance(pacing.turnMs - 100);
	fireEvent.click(
		within(screen.getByRole("group", { name: "Champions" })).getByRole(
			"button",
			{ name: "Cragbell" },
		),
	);
	fireEvent.click(screen.getByRole("button", { name: "Confirm ban" }));
	await advance(100);
	expect(core.sent.map((c) => c.kind)).toEqual([
		"series.start",
		"side.choose",
		"draft.ai",
		"draft.ban",
	]);
	expect(screen.queryByRole("timer")).toBeNull();
	core.unmount();
	await advance(pacing.turnMs);
	expect(core.sent.at(-1)?.kind).toBe("draft.ban");
});
