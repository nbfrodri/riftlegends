import { expect, test, vi } from "vitest";
import { createMainWindowOptions, secureNavigation } from "../src/main/window";

test("creates a frameless window", () => {
	expect(createMainWindowOptions().frame).toBe(false);
});

test("isolates and sandboxes the renderer without Node integration", () => {
	expect(createMainWindowOptions().webPreferences).toMatchObject({
		contextIsolation: true,
		sandbox: true,
		nodeIntegration: false,
	});
});

function navigation() {
	const contents = {
		on: vi.fn(),
		setWindowOpenHandler: vi.fn(),
	};
	const openExternal = vi.fn().mockResolvedValue(undefined);
	secureNavigation(contents, openExternal);
	const navigate = contents.on.mock.calls.find(
		([name]) => name === "will-navigate",
	)?.[1];
	const open = contents.setWindowOpenHandler.mock.calls[0]?.[0];
	return { navigate, open, openExternal };
}

test("prevents navigation even to the attribution site", () => {
	const { navigate, openExternal } = navigation();
	const preventDefault = vi.fn();
	navigate({ preventDefault, url: "https://lol.fandom.com/" });
	expect(preventDefault).toHaveBeenCalledOnce();
	expect(openExternal).not.toHaveBeenCalled();
});

test("opens the Leaguepedia attribution in the system browser only", () => {
	const { open, openExternal } = navigation();
	const url = "https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki";
	expect(open({ url })).toEqual({ action: "deny" });
	expect(openExternal).toHaveBeenCalledExactlyOnceWith(url);
});

test.each([
	"https://other.example/",
	"https://lol.fandom.com.example/",
	"https://lol.fandom.com@other.example/",
	"https://user@lol.fandom.com/",
	"https://lol.fandom.com:8443/",
	"http://lol.fandom.com/",
	"file:///tmp/data",
	"blob:https://lol.fandom.com/id",
	"mailto:someone@example.org",
	"about:blank",
	"invalid",
])("denies the popup and leaves the browser closed for %s", (url) => {
	const { open, openExternal } = navigation();
	expect(open({ url })).toEqual({ action: "deny" });
	expect(openExternal).not.toHaveBeenCalled();
});
