import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { pingChannel } from "../shared/bridge";
import { registerSystemLocale } from "./system-locale";
import { createMainWindowOptions, secureNavigation } from "./window";
import { registerWindowControls, supportsMinimize } from "./window-controls";

app.whenReady().then(async () => {
	const window = new BrowserWindow(createMainWindowOptions());
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
