import { expect, test } from "vitest";
import { supportsMinimize } from "../src/main/window-controls";

test.each([
	["linux", { XDG_CURRENT_DESKTOP: "Hyprland" }, false],
	["linux", { XDG_CURRENT_DESKTOP: "sway" }, false],
	["linux", { XDG_CURRENT_DESKTOP: "river" }, false],
	["linux", { XDG_CURRENT_DESKTOP: "niri" }, false],
	["linux", { XDG_SESSION_DESKTOP: "hyprland" }, false],
	["linux", { XDG_CURRENT_DESKTOP: "ubuntu:GNOME" }, true],
	["linux", { XDG_CURRENT_DESKTOP: "KDE" }, true],
	["linux", {}, true],
	["win32", { XDG_CURRENT_DESKTOP: "Hyprland" }, true],
] as const)("%s %o -> minimize %s", (platform, env, expected) => {
	expect(supportsMinimize(platform, env)).toBe(expected);
});
