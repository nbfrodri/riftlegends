import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	COUNTDOWN_SECONDS,
	startCountdownTicks,
} from "../src/renderer/sound/countdown-ticks";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("countdown ticks (#505)", () => {
	test("the client ticks over the last 10 seconds of a turn", () => {
		expect(COUNTDOWN_SECONDS).toBe(10);
	});

	test("ticks once per second in the last seconds, never before", () => {
		const play = vi.fn();
		startCountdownTicks(performance.now() + 30_000, play);
		vi.advanceTimersByTime(19_999);
		expect(play).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(play).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(9_000);
		expect(play).toHaveBeenCalledTimes(10);
		// The deadline itself is the timeout, not a tick.
		vi.advanceTimersByTime(5_000);
		expect(play).toHaveBeenCalledTimes(10);
	});

	test("a turn shorter than the countdown ticks from its start", () => {
		const play = vi.fn();
		startCountdownTicks(performance.now() + 3_000, play);
		vi.advanceTimersByTime(10_000);
		expect(play).toHaveBeenCalledTimes(3);
	});

	test("stopping silences the rest", () => {
		const play = vi.fn();
		const stop = startCountdownTicks(performance.now() + 30_000, play);
		vi.advanceTimersByTime(22_000);
		expect(play).toHaveBeenCalledTimes(3);
		stop();
		vi.advanceTimersByTime(20_000);
		expect(play).toHaveBeenCalledTimes(3);
	});
});
