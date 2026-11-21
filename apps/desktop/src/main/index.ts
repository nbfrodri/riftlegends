import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell, utilityProcess } from "electron";
import coreHostPath from "../core-host/index?modulePath";
import { pingChannel } from "../shared/bridge";
import { createAssetCache } from "./assets/cache";
import { type CoreProcess, createCoreBridge } from "./core-bridge";
import { registerCoreIpc } from "./core-ipc";
import { registerSystemLocale } from "./system-locale";
import { createMainWindowOptions, secureNavigation } from "./window";
import { registerWindowControls, supportsMinimize } from "./window-controls";

async function start() {
	const window = new BrowserWindow(createMainWindowOptions());
	const assets = createAssetCache(app.getPath("userData"), {
		...(process.env.RIFT_E2E_OFFLINE === "1" && {
			transport: async () => {
				throw Object.assign(new Error("Asset network unavailable"), {
					code: "ENETUNREACH",
				});
			},
		}),
	});
	void assets.sync();
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

	const core = createCoreBridge({
		spawn: () =>
			utilityProcess.fork(coreHostPath, [], {
				serviceName: "Rift Legends core",
			}) as unknown as CoreProcess,
		timeoutMs: 10_000,
	});
	registerCoreIpc(window, ipcMain, core);
	app.once("before-quit", () => core.dispose());
	// End-to-end tests drive the core from the main process.
	// E2E only (plan 04). Separate flags: the probe opens its own session,
	// which would race with a test that drives the bridge directly.
	if (process.env.RIFT_E2E_CORE === "1") {
		Object.assign(globalThis, { riftCore: core });
	}
	const query: Record<string, string> =
		process.env.RIFT_E2E_PROBE === "1" ? { probe: "core" } : {};

	if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
		const url = new URL(process.env.ELECTRON_RENDERER_URL);
		for (const [key, value] of Object.entries(query)) {
			url.searchParams.set(key, value);
		}
		await window.loadURL(url.toString());
	} else {
		await window.loadFile(join(__dirname, "../renderer/index.html"), {
			query,
		});
	}
}

if (app.requestSingleInstanceLock()) {
	app.on("second-instance", () => {
		const [window] = BrowserWindow.getAllWindows();
		if (window?.isMinimized()) window.restore();
		window?.focus();
	});
	app.on("window-all-closed", () => app.quit());
	void app.whenReady().then(start);
} else {
	app.quit();
}
