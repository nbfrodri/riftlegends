import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { firstAvailable } from "./draft-board-kit";
import { renderWithDraftCore, seedNextSeries } from "./draft-core";

const sound = vi.hoisted(() => ({ play: vi.fn(), preload: vi.fn() }));
vi.mock("../src/renderer/sound", () => ({
	playSound: sound.play,
	preloadSounds: sound.preload,
}));

beforeEach(() => sound.play.mockClear());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const ticks = () => sound.play.mock.calls.filter(([id]) => id === "tick");

async function start(timer: boolean) {
	await renderWithDraftCore(<DraftScreen />);
	const begin = await screen.findByRole("button", { name: "Start series" });
	if (timer) fireEvent.click(screen.getByRole("radio", { name: "On" }));
	seedNextSeries();
	fireEvent.click(begin);
	fireEvent.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
	const go = await screen.findByRole("button", { name: "Go to draft" });
	vi.useFakeTimers();
	fireEvent.click(go);
	await advance(10);
}

// #505: the client ticks in the last 10 s of the user's own ban or pick.
test("my turn ticks once per second over its last 10 seconds", async () => {
	await start(true);
	await advance(pacing.turnMs - 10_000 - 100);
	expect(ticks()).toHaveLength(0);
	await advance(100);
	expect(ticks()).toHaveLength(1);
	await advance(9_000);
	expect(ticks()).toHaveLength(10);
});

test("confirming stops the ticks at once", async () => {
	await start(true);
	await advance(pacing.turnMs - 7_000);
	const before = ticks().length;
	expect(before).toBeGreaterThan(0);
	fireEvent.click(firstAvailable());
	fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
	await advance(20_000);
	// A new turn of mine would only tick again after its own 20 quiet seconds.
	expect(ticks()).toHaveLength(before);
});

test("the AI's turn never ticks", async () => {
	await start(true);
	fireEvent.click(firstAvailable());
	fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
	await advance(pacing.aiPauseMs + 10);
	expect(screen.queryByRole("timer")).not.toBeNull();
	await advance(19_000);
	expect(ticks()).toHaveLength(0);
});

test("a game without the timer never ticks", async () => {
	await start(false);
	await advance(60_000);
	expect(ticks()).toHaveLength(0);
});
