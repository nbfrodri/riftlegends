import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY } from "../src/renderer/language";

vi.mock("react-dom/client", () => ({
	createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

afterEach(() => {
	document.body.replaceChildren();
	document.documentElement.lang = "";
	localStorage.clear();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	vi.resetModules();
});

test.each([
	{ stored: "es", locale: "es", calls: 0 },
	{ stored: null, locale: "en", calls: 1 },
])(
	"mounts in $locale when system locale IPC is broken and preference is $stored",
	async ({ stored, locale, calls }) => {
		const systemLocale = vi.fn().mockRejectedValue(new Error("IPC failed"));
		vi.stubGlobal("riftlegends", { systemLocale });
		if (stored) localStorage.setItem(LANGUAGE_STORAGE_KEY, stored);
		const root = document.createElement("div");
		root.id = "root";
		document.body.append(root);

		await import("../src/renderer/index");

		await vi.waitFor(() => {
			expect(createRoot).toHaveBeenCalledWith(root);
			expect(document.documentElement.lang).toBe(locale);
		});
		expect(systemLocale).toHaveBeenCalledTimes(calls);
	},
);
