import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import {
	GAME_CURSOR_STORAGE_KEY,
	getGameCursor,
	setGameCursor,
} from "../src/renderer/cursor/settings";
import { createAppRouter } from "../src/renderer/router";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

beforeEach(() => {
	localStorage.clear();
	setGameCursor(true);
	localStorage.clear();
	window.history.replaceState(null, "", "?content=fictional");
});
afterEach(cleanup);

async function renderSettings(locale = "en-US") {
	await renderInLocale(
		<AssetsProvider api={fakeAssets().api}>
			<RouterProvider router={createAppRouter("/ajustes")} />
		</AssetsProvider>,
		locale,
	);
	await screen.findByRole("heading", { level: 1 });
	return userEvent.setup();
}

describe("game cursor setting (#515)", () => {
	test("is on by default, with nothing stored", () => {
		expect(getGameCursor({ reload: true })).toBe(true);
	});

	test("reads a stored off, and ignores junk", () => {
		localStorage.setItem(GAME_CURSOR_STORAGE_KEY, "false");
		expect(getGameCursor({ reload: true })).toBe(false);
		localStorage.setItem(GAME_CURSOR_STORAGE_KEY, "nonsense");
		expect(getGameCursor({ reload: true })).toBe(true);
	});

	test("setting it stores it and marks the document", () => {
		setGameCursor(false);
		expect(localStorage.getItem(GAME_CURSOR_STORAGE_KEY)).toBe("false");
		expect(document.documentElement.dataset.gameCursor).toBe("off");
		setGameCursor(true);
		expect(localStorage.getItem(GAME_CURSOR_STORAGE_KEY)).toBe("true");
		expect(document.documentElement.dataset.gameCursor).toBe("on");
	});

	test("Settings has a Game cursor switch, on by default", async () => {
		const user = await renderSettings();
		const group = screen.getByRole("radiogroup", { name: "Game cursor" });
		expect(
			(screen.getByRole("radio", { name: "On" }) as HTMLInputElement).checked,
		).toBe(true);
		expect(group).toBeTruthy();
		await user.click(screen.getByRole("radio", { name: "Off" }));
		expect(getGameCursor()).toBe(false);
		expect(document.documentElement.dataset.gameCursor).toBe("off");
		expect(localStorage.getItem(GAME_CURSOR_STORAGE_KEY)).toBe("false");
	});

	test("Spanish label", async () => {
		await renderSettings("es-ES");
		expect(
			screen.getByRole("radiogroup", { name: "Cursor del juego" }),
		).toBeTruthy();
	});
});
