import { act, fireEvent, screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { seedNextSeries } from "./draft-core";

export type User = ReturnType<typeof userEvent.setup>;

/** Starts a series as Forge on the blue side: Forge bans first. */
export async function toBoard(user: User) {
	await screen.findByRole("heading", { level: 1, name: "Set up series" });
	seedNextSeries();
	await user.click(screen.getByRole("button", { name: "Start series" }));
	await user.click(
		await screen.findByRole("button", { name: "Confirm choice" }),
	);
	await user.click(await screen.findByRole("button", { name: "Go to draft" }));
	await screen.findByRole("heading", { level: 1, name: "Draft" });
}

export const tile = (name: string | RegExp) =>
	within(screen.getByRole("group", { name: "Champions" })).getByRole("button", {
		name,
	});
export const confirm = () => screen.getByRole("button", { name: /^Confirm/ });

export async function choose(user: User, champion: string) {
	await user.click(tile(champion));
	await user.click(confirm());
}

export async function confirmAndWaitForRival() {
	vi.useFakeTimers();
	try {
		fireEvent.click(confirm());
		await act(() => vi.advanceTimersByTimeAsync(10));
		await act(() => vi.advanceTimersByTimeAsync(pacing.aiPauseMs));
		await act(() => vi.advanceTimersByTimeAsync(10));
	} finally {
		vi.useRealTimers();
	}
}

export function firstAvailable() {
	const available = within(screen.getByRole("group", { name: "Champions" }))
		.getAllByRole("button")
		.find((button) => !button.hasAttribute("aria-disabled"));
	if (!available) throw new Error("no free champion");
	return available;
}

export async function toFirstPick(user: User) {
	await toBoard(user);
	for (let ban = 0; ban < 3; ban++) {
		await user.click(firstAvailable());
		await confirmAndWaitForRival();
	}
	await screen.findByText("B1 · Forge pick");
}
