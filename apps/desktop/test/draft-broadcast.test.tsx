import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
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

describe("#419: the turn timer is a bar shrinking from both sides", () => {
	const bar = () =>
		screen.getByRole("timer").querySelector("[data-timer-bar]") as HTMLElement;
	const forgeSide = () =>
		screen.queryByRole("region", { name: "Blue side Forge" }) ? "blue" : "red";

	test("shrinks to the centre over the whole turn in the picking side's colour", async () => {
		await start(true);
		expect(bar().className).toContain(`bg-side-${forgeSide()}`);
		expect(bar().className).toContain("origin-center");
		await advance(50);
		expect(bar().style.transform).toBe("scaleX(0)");
		expect(bar().style.transitionDuration).toBe(`${pacing.turnMs}ms`);
		expect(bar().style.transitionTimingFunction).toBe("linear");
		// The time left stays readable for screen readers, without a sign.
		expect(screen.getByRole("timer").textContent).toBe("00:30");
	});

	test("sits above the board, across both team columns and the pool", async () => {
		await start(true);
		const timer = screen.getByRole("timer");
		const blue = screen.getByRole("region", { name: /^Blue side / });
		const red = screen.getByRole("region", { name: /^Red side / });
		const board = blue.parentElement;
		expect(board).toBe(red.parentElement);
		// One line over the whole board, not a widget in the page header.
		expect(board?.contains(timer)).toBe(true);
		expect(timer.className).toMatch(/\binset-x-0\b/);
		expect(timer.className).toMatch(/\bbottom-full\b/);
		expect(document.querySelector("header")?.contains(timer)).toBe(false);
	});

	test("with reduced motion it steps every second, proportional to the time left", async () => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		vi.spyOn(media, "matches", "get").mockReturnValue(true);
		vi.spyOn(window, "matchMedia").mockReturnValue(media);
		await start(true);
		expect(bar().style.transform).toBe("scaleX(1)");
		await advance(10_000);
		expect(bar().style.transform).toBe("scaleX(0.667)");
		expect(bar().style.transitionDuration).toBe("");
		expect(screen.getByRole("timer").textContent).toBe("00:20");
	});
});
