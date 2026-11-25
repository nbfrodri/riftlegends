import type { AssetProgress } from "@rift-legends/contracts";
import type { IpcRenderer, IpcRendererEvent } from "electron";
import { type AssetsApi, assetChannels } from "../shared/bridge";

export const createAssetsApi = (
	ipc: Pick<IpcRenderer, "invoke" | "on" | "off">,
): AssetsApi => ({
	status: () => ipc.invoke(assetChannels.status),
	sync: () => ipc.invoke(assetChannels.sync),
	champions: () => ipc.invoke(assetChannels.champions),
	teamLogos: () => ipc.invoke(assetChannels.teamLogos),
	playerPhotos: () => ipc.invoke(assetChannels.playerPhotos),
	leagueLogos: () => ipc.invoke(assetChannels.leagueLogos),
	sounds: () => ipc.invoke(assetChannels.sounds),
	subscribe(listener) {
		const notify = (_event: IpcRendererEvent, progress: AssetProgress) =>
			listener(progress);
		ipc.on(assetChannels.progress, notify);
		return () => {
			ipc.off(assetChannels.progress, notify);
		};
	},
	subscribePlayerPhotos(listener) {
		const notify = () => listener();
		ipc.on(assetChannels.playerPhotosChanged, notify);
		return () => {
			ipc.off(assetChannels.playerPhotosChanged, notify);
		};
	},
	subscribeTeamLogos(listener) {
		const notify = () => listener();
		ipc.on(assetChannels.teamLogosChanged, notify);
		return () => {
			ipc.off(assetChannels.teamLogosChanged, notify);
		};
	},
});
