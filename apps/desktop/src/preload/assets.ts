import type { AssetProgress } from "@rift-legends/contracts";
import type { IpcRenderer, IpcRendererEvent } from "electron";
import { type AssetsApi, assetChannels } from "../shared/bridge";

export const createAssetsApi = (
	ipc: Pick<IpcRenderer, "invoke" | "on" | "off">,
): AssetsApi => ({
	status: () => ipc.invoke(assetChannels.status),
	sync: () => ipc.invoke(assetChannels.sync),
	champions: () => ipc.invoke(assetChannels.champions),
	subscribe(listener) {
		const notify = (_event: IpcRendererEvent, progress: AssetProgress) =>
			listener(progress);
		ipc.on(assetChannels.progress, notify);
		return () => {
			ipc.off(assetChannels.progress, notify);
		};
	},
});
