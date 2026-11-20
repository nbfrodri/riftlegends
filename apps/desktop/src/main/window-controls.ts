import type { BrowserWindow, IpcMain } from "electron";
import { windowChannels } from "../shared/bridge";

// Tiling Wayland compositors ignore xdg_toplevel minimize requests; Electron then
// treats the window as minimized and stops painting until it is reconfigured.
const desktopsWithoutMinimize = ["hyprland", "sway", "river", "niri"];

export function supportsMinimize(
	platform: NodeJS.Platform,
	env: Readonly<Record<string, string | undefined>>,
): boolean {
	if (platform !== "linux") return true;
	const desktops = [env.XDG_CURRENT_DESKTOP, env.XDG_SESSION_DESKTOP].flatMap(
		(value) => value?.toLowerCase().split(":") ?? [],
	);
	return !desktops.some((desktop) => desktopsWithoutMinimize.includes(desktop));
}

export function registerWindowControls(
	window: BrowserWindow,
	ipc: Pick<IpcMain, "handle" | "removeHandler">,
	{ canMinimize }: { canMinimize: boolean },
) {
	const actions = {
		[windowChannels.minimize]: () => {
			if (!canMinimize) throw new Error("This desktop cannot minimize windows");
			window.minimize();
		},
		[windowChannels.toggleMaximize]: () => {
			if (window.isMaximized()) window.unmaximize();
			else window.maximize();
		},
		[windowChannels.close]: () => window.close(),
		[windowChannels.isMaximized]: () => window.isMaximized(),
		[windowChannels.canMinimize]: () => canMinimize,
	};
	for (const [channel, action] of Object.entries(actions)) {
		ipc.handle(channel, (event) => {
			if (event.senderFrame !== window.webContents.mainFrame) {
				throw new Error("Window controls require the main frame");
			}
			return action();
		});
	}
	const publishState = () => {
		window.webContents.send(
			windowChannels.maximizedChange,
			window.isMaximized(),
		);
	};
	window.on("maximize", publishState);
	window.on("unmaximize", publishState);
	window.once("closed", () => {
		for (const channel of Object.keys(actions)) ipc.removeHandler(channel);
	});
}
