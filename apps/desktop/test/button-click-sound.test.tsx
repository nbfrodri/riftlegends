import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import { ButtonClickSound } from "../src/renderer/sound/button-click";
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

describe("button click sound (#493)", () => {
	test("pressing a button plays click, once, with one listener for all", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ButtonClickSound />
				<button type="button">Plain</button>
				<button type="button">
					<span>Nested label</span>
				</button>
				<div role="button" tabIndex={0}>
					Custom
				</div>
			</>,
		);
		await user.click(screen.getByRole("button", { name: "Plain" }));
		expect(played()).toEqual(["click"]);
		await user.click(screen.getByText("Nested label"));
		expect(played()).toEqual(["click", "click"]);
		await user.click(screen.getByRole("button", { name: "Custom" }));
		expect(played()).toEqual(["click", "click", "click"]);
	});

	test("keyboard activation also clicks", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ButtonClickSound />
				<button type="button">Go</button>
			</>,
		);
		screen.getByRole("button", { name: "Go" }).focus();
		await user.keyboard("{Enter}");
		expect(played()).toEqual(["click"]);
	});

	test("disabled buttons, other elements and opted-out buttons stay silent", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ButtonClickSound />
				<button type="button" disabled>
					Off
				</button>
				<button type="button" aria-disabled="true">
					Unavailable
				</button>
				<button type="button" data-silent-click>
					Silent
				</button>
				<p>Text</p>
			</>,
		);
		await user.click(screen.getByRole("button", { name: "Off" }));
		await user.click(screen.getByRole("button", { name: "Unavailable" }));
		await user.click(screen.getByRole("button", { name: "Silent" }));
		await user.click(screen.getByText("Text"));
		expect(played()).toEqual([]);
	});

	test("it preloads the sounds for the whole app", () => {
		render(<ButtonClickSound />);
		expect(sound.preload).toHaveBeenCalled();
	});

	test("on the draft board, tiles and Confirm keep their own sound, never a click too", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(
			<>
				<ButtonClickSound />
				<DraftScreen />
			</>,
		);
		await toBoard(user);
		sound.play.mockClear();

		await user.click(firstAvailable());
		expect(played()).toEqual(["select"]);

		await confirmAndWaitForRival();
		expect(played()).toEqual(["select", "ban", "ban"]);
	});

	test("confirming my pick plays only lock and pick", async () => {
		const user = userEvent.setup();
		await renderWithDraftCore(
			<>
				<ButtonClickSound />
				<DraftScreen />
			</>,
		);
		await toFirstPick(user);
		sound.play.mockClear();

		await user.click(firstAvailable());
		await confirmAndWaitForRival();
		expect(played()).not.toContain("click");
		expect(played().slice(0, 2)).toEqual(["select", "lock"]);
	});
});
