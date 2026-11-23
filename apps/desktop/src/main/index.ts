import { join } from "node:path";
import {
	app,
	BrowserWindow,
	ipcMain,
	protocol,
	shell,
	utilityProcess,
} from "electron";
import snapshot from "../../../../packages/core/content/real/logos.json";
import coreHostPath from "../core-host/index?modulePath";
import { pingChannel } from "../shared/bridge";
import { createAssetCache } from "./assets/cache";
import { registerAssetIpc } from "./assets/ipc";
import { assetScheme, serveAsset } from "./assets/protocol";
import { type CoreProcess, createCoreBridge } from "./core-bridge";
import { registerCoreIpc } from "./core-ipc";
import { registerSystemLocale } from "./system-locale";
import { createMainWindowOptions, secureNavigation } from "./window";
import { registerWindowControls, supportsMinimize } from "./window-controls";

protocol.registerSchemesAsPrivileged([
	{ scheme: assetScheme, privileges: { secure: true } },
]);

async function start() {
	const window = new BrowserWindow(createMainWindowOptions());
	const userData = app.getPath("userData");
	const assets = createAssetCache(userData, {
		logos: snapshot.logos,
		...(process.env.RIFT_E2E_OFFLINE === "1" && {
			transport: async () => {
				throw Object.assign(new Error("Asset network unavailable"), {
					code: "ENETUNREACH",
				});
			},
		}),
	});
	const { session } = window.webContents;
	session.protocol.handle(assetScheme, (request) =>
		serveAsset(userData, request),
	);
	registerAssetIpc(window, ipcMain, assets);
	void assets.sync();
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
	const query: Record<string, string> = {
		...(process.env.RIFT_E2E_PROBE === "1" && { probe: "core" }),
		// E2E only: the Champions screen with the fictional set (offline tests).
		...(process.env.RIFT_E2E_CONTENT === "fictional" && {
			content: "fictional",
		}),
	};

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

app.on("window-all-closed", () => app.quit());
void app.whenReady().then(start);
