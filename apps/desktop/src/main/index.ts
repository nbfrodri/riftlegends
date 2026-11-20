import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { pingChannel } from "../shared/bridge";
import { registerSystemLocale } from "./system-locale";
import { createMainWindowOptions, secureNavigation } from "./window";
import { registerWindowControls, supportsMinimize } from "./window-controls";

app.whenReady().then(async () => {
	const options = createMainWindowOptions();
	// Hyprland floats a fixed-size client. Scope the override to T1 launches.
	const size = process.env.RIFT_S1_VIEWPORT;
	if (size === "1366x768" || size === "1280x720") {
		// This Electron/Hyprland pair grants 20 extra logical pixels per axis
		// to a fixed-size client. The runner checks the actual CSS viewport.
		const [width, height] = size.split("x").map((axis) => Number(axis) - 20);
		Object.assign(options, {
			width,
			height,
			minWidth: width,
			minHeight: height,
			maxWidth: width,
			maxHeight: height,
			resizable: false,
			hasShadow: false,
		});
	}
	const window = new BrowserWindow(options);
	const { session } = window.webContents;
	session.setPermissionCheckHandler(() => false);
	session.setPermissionRequestHandler((_contents, _permission, reply) =>
		reply(false),
	);
	secureNavigation(window.webContents, shell.openExternal);
	registerWindowControls(window, ipcMain, {
		canMinimize: supportsMinimize(process.platform, process.env),
	});
	registerSystemLocale(window, ipcMain, app.getLocale());
	ipcMain.handle(pingChannel, (event): "pong" => {
		if (event.senderFrame !== window.webContents.mainFrame) {
			throw new Error("Ping requires the main frame");
		}
		return "pong";
	});
	window.once("closed", () => ipcMain.removeHandler(pingChannel));

	if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
		await window.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		await window.loadFile(join(__dirname, "../renderer/index.html"));
	}
});

app.on("window-all-closed", () => app.quit());
