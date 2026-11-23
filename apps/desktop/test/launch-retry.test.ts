import { describe, expect, it, vi } from "vitest";
import { isDisplayLaunchFailure, withLaunchRetry } from "../e2e/launch-retry";

const displayError = new Error(
	"electron.launch: Process failed to launch!\n" +
		"[err] ERROR:ui/ozone/platform/x11/ozone_platform_x11.cc:257] Missing X server or $DISPLAY\n" +
		"[err] ERROR:ui/aura/env.cc:253] The platform failed to initialize.  Exiting.",
);

describe("isDisplayLaunchFailure", () => {
	it("recognises the transient X server failure", () => {
		expect(isDisplayLaunchFailure(displayError)).toBe(true);
	});

	it("ignores other launch failures and non-errors", () => {
		expect(
			isDisplayLaunchFailure(
				new Error("electron.launch: Process failed to launch!"),
			),
		).toBe(false);
		expect(isDisplayLaunchFailure(new Error("boom"))).toBe(false);
		expect(isDisplayLaunchFailure("Missing X server or $DISPLAY")).toBe(false);
	});
});

describe("withLaunchRetry", () => {
	it("returns the first result without retrying", async () => {
		const launch = vi.fn().mockResolvedValue("app");
		await expect(withLaunchRetry(launch)).resolves.toBe("app");
		expect(launch).toHaveBeenCalledTimes(1);
	});

	it("retries once after a display failure", async () => {
		const launch = vi
			.fn()
			.mockRejectedValueOnce(displayError)
			.mockResolvedValue("app");
		await expect(withLaunchRetry(launch, { delayMs: 0 })).resolves.toBe("app");
		expect(launch).toHaveBeenCalledTimes(2);
	});

	it("gives up after the bounded attempts and rethrows", async () => {
		const launch = vi.fn().mockRejectedValue(displayError);
		await expect(withLaunchRetry(launch, { delayMs: 0 })).rejects.toBe(
			displayError,
		);
		expect(launch).toHaveBeenCalledTimes(3);
	});

	it("does not retry any other error", async () => {
		const other = new Error("Cannot find module");
		const launch = vi.fn().mockRejectedValue(other);
		await expect(withLaunchRetry(launch, { delayMs: 0 })).rejects.toBe(other);
		expect(launch).toHaveBeenCalledTimes(1);
	});
});
