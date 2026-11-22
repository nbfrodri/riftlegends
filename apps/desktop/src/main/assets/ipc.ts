import { type AssetStatus, assetRequestArgs } from "@rift-legends/contracts";
import type { BrowserWindow, IpcMain } from "electron";
import { assetChannels } from "../../shared/bridge";
import type { createAssetCache } from "./cache";

type Cache = ReturnType<typeof createAssetCache>;

function publicStatus(status: ReturnType<Cache["getStatus"]>): AssetStatus {
	// Filesystem and transport error details can contain local paths.
	return status.state === "error" ? { state: "error" } : status;
}

export function registerAssetIpc(
	window: BrowserWindow,
	ipc: Pick<IpcMain, "handle" | "removeHandler">,
	cache: Cache,
) {
	const { webContents } = window;
	for (const [channel, handle] of [
		[assetChannels.status, () => publicStatus(cache.getStatus())],
		[assetChannels.sync, () => cache.sync().then(publicStatus)],
		[assetChannels.champions, () => cache.getChampions()],
	] as const) {
		ipc.handle(channel, (event, ...args: unknown[]) => {
			if (!event.senderFrame || event.senderFrame !== webContents.mainFrame) {
				throw new Error(`${channel} requires the main frame`);
			}
			if (!assetRequestArgs.safeParse(args).success) {
				throw new Error(`${channel} takes no arguments`);
			}
			return handle();
		});
	}

	const stop = cache.subscribe((progress) => {
		if (!webContents.isDestroyed()) {
			webContents.send(assetChannels.progress, progress);
		}
	});
	window.once("closed", () => {
		stop();
		ipc.removeHandler(assetChannels.status);
		ipc.removeHandler(assetChannels.sync);
		ipc.removeHandler(assetChannels.champions);
	});
}
