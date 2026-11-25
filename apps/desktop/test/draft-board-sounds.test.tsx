import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import {
	confirmAndWaitForRival,
	firstAvailable,
	toBoard,
	toFirstPick,
} from "./draft-board-kit";
import { renderWithDraftCore } from "./draft-core";

const sound = vi.hoisted(() => ({ play: vi.fn(), preload: vi.fn() }));
vi.mock("../src/renderer/sound", () => ({
	playSound: sound.play,
	preloadSounds: sound.preload,
}));

beforeEach(() => {
	sound.play.mockClear();
	sound.preload.mockClear();
});
afterEach(cleanup);

const played = () => sound.play.mock.calls.map(([id]) => id);

describe("draft sounds on the board (#472)", () => {
	test("the draft preloads its sounds", async () => {
		await renderWithDraftCore(<DraftScreen />);
		expect(sound.preload).toHaveBeenCalled();
	});

	test("selecting a champion plays select; confirming a ban plays ban, also the rival's", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toBoard(user);
		expect(played()).toEqual([]);

		await user.click(firstAvailable());
		expect(played()).toEqual(["select"]);

		await confirmAndWaitForRival();
		// Mine, then the rival's.
		expect(played()).toEqual(["select", "ban", "ban"]);
	});

	test("confirming my pick locks it in; the rival's picks play pick", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(<DraftScreen />);
		await toFirstPick(user);
		sound.play.mockClear();

		await user.click(firstAvailable());
		await confirmAndWaitForRival();
		await waitFor(() =>
			expect(played()).toEqual(["select", "lock", "pick", "pick"]),
		);
		expect(screen.getByText("B2 · Forge pick")).toBeTruthy();
	});
});
