import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { createAppRouter } from "../src/renderer/router";
import {
	defaultSoundSettings,
	effectiveVolume,
	getSoundSettings,
	SOUND_STORAGE_KEY,
	setSoundSettings,
} from "../src/renderer/sound/settings";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

beforeEach(() => {
	localStorage.clear();
	setSoundSettings(defaultSoundSettings);
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

const stored = () =>
	JSON.parse(localStorage.getItem(SOUND_STORAGE_KEY) ?? "{}");

describe("sound settings (#472)", () => {
	test("each volume has a slider with its value and a mute button", async () => {
		await renderSettings();
		expect(screen.getByRole("heading", { name: "Sound" })).toBeTruthy();
		const master = screen.getByRole("slider", { name: "Master volume" });
		const effects = screen.getByRole("slider", { name: "Effects volume" });
		expect(master.getAttribute("aria-valuetext")).toBe(
			`${defaultSoundSettings.master}%`,
		);
		expect(effects.getAttribute("aria-valuetext")).toBe(
			`${defaultSoundSettings.effects}%`,
		);
		expect(
			screen
				.getByRole("button", { name: "Mute master volume" })
				.getAttribute("aria-pressed"),
		).toBe("false");
	});

	test("moving a slider stores and applies the volume", async () => {
		await renderSettings();
		const master = screen.getByRole("slider", { name: "Master volume" });
		fireEvent.keyDown(master, { key: "End" });
		await waitFor(() => expect(stored().master).toBe(100));
		expect(getSoundSettings().master).toBe(100);
		const effects = screen.getByRole("slider", { name: "Effects volume" });
		fireEvent.keyDown(effects, { key: "Home" });
		await waitFor(() => expect(stored().effects).toBe(0));
		expect(effectiveVolume(getSoundSettings())).toBe(0);
	});

	test("mute silences without losing the level, and unmute restores it", async () => {
		const user = await renderSettings();
		await user.click(screen.getByRole("button", { name: "Mute effects" }));
		expect(stored()).toMatchObject({
			effectsMuted: true,
			effects: defaultSoundSettings.effects,
		});
		expect(effectiveVolume(getSoundSettings())).toBe(0);
		const unmute = screen.getByRole("button", { name: "Mute effects" });
		expect(unmute.getAttribute("aria-pressed")).toBe("true");
		await user.click(unmute);
		expect(effectiveVolume(getSoundSettings())).toBeGreaterThan(0);
	});

	test("Spanish labels", async () => {
		await renderSettings("es-ES");
		expect(screen.getByRole("heading", { name: "Sonido" })).toBeTruthy();
		expect(
			screen.getByRole("slider", { name: "Volumen general" }),
		).toBeTruthy();
		expect(
			screen.getByRole("slider", { name: "Volumen de efectos" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Silenciar efectos" }),
		).toBeTruthy();
	});
});
