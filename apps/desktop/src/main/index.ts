import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { pingChannel } from "../shared/bridge";
import { createMainWindowOptions, secureNavigation } from "./window";
import { registerWindowControls, supportsMinimize } from "./window-controls";

app.whenReady().then(async () => {
	const window = new BrowserWindow(createMainWindowOptions());
	secureNavigation(window.webContents, shell.openExternal);
	registerWindowControls(window, ipcMain, {
		canMinimize: supportsMinimize(process.platform, process.env),
	});
	ipcMain.handle(pingChannel, (): "pong" => "pong");

	if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
		await window.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		await window.loadFile(join(__dirname, "../renderer/index.html"));
	}
});

app.on("window-all-closed", () => app.quit());
