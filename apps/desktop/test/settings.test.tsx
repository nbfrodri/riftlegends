import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { initialLocale, LANGUAGE_STORAGE_KEY } from "../src/renderer/language";
import { createAppRouter } from "../src/renderer/router";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

beforeEach(() => {
	localStorage.clear();
	// Past the startup screen: the test seam opens the app with fictional content.
	window.history.replaceState(null, "", "?content=fictional");
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	document.documentElement.lang = "";
});

async function renderSettings(locale: string) {
	await renderInLocale(
		<AssetsProvider api={fakeAssets().api}>
			<RouterProvider router={createAppRouter("/ajustes")} />
		</AssetsProvider>,
		locale,
	);
	await screen.findByRole("heading", { level: 1 });
	return userEvent.setup();
}

async function choose(
	user: ReturnType<typeof userEvent.setup>,
	trigger: string,
	option: string,
) {
	await user.click(screen.getByRole("combobox", { name: trigger }));
	await user.click(await screen.findByRole("option", { name: option }));
}

describe("T9: language selector", () => {
	test("shows the current language by label, not by value", async () => {
		await renderSettings("en-US");
		expect(
			screen.getByRole("heading", { level: 1, name: "Settings" }),
		).toBeTruthy();
		expect(
			screen.getByRole("combobox", { name: "Language" }).textContent,
		).toContain("English");
	});

	test("changing it relabels the whole UI at once", async () => {
		const user = await renderSettings("en-US");
		await choose(user, "Language", "Español");
		await waitFor(() =>
			expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
				"Ajustes",
			),
		);
		expect(
			within(
				screen.getByRole("navigation", { name: "Secciones del club" }),
			).getByRole("button", { name: "Mercado" }),
		).toBeTruthy();
		expect(
			screen.getByRole("combobox", { name: "Idioma" }).textContent,
		).toContain("Español");
	});

	test("updates <html lang> and stores the preference", async () => {
		const user = await renderSettings("en-US");
		await choose(user, "Language", "Español");
		await waitFor(() => expect(document.documentElement.lang).toBe("es"));
		expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
	});

	test("still changes the language when storage is unavailable", async () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("denied");
		});
		const user = await renderSettings("en-US");
		await choose(user, "Language", "Español");
		await waitFor(() => expect(document.documentElement.lang).toBe("es"));
	});
});

describe("initialLocale", () => {
	const systemLocale = async () => "es-ES";

	test("falls back to the system locale without a stored choice", async () => {
		expect(await initialLocale(systemLocale)).toBe("es-ES");
	});

	test("the stored choice wins over the system locale", async () => {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
		expect(await initialLocale(systemLocale)).toBe("en");
		localStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
		expect(await initialLocale(async () => "en-US")).toBe("es");
	});

	test("ignores a corrupt stored value", async () => {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, "klingon");
		expect(await initialLocale(systemLocale)).toBe("es-ES");
	});

	test("ignores unavailable storage", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("denied");
		});
		expect(await initialLocale(systemLocale)).toBe("es-ES");
	});
});
