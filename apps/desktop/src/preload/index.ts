import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import {
	pingChannel,
	type RiftLegendsAPI,
	windowChannels,
} from "../shared/bridge";

contextBridge.exposeInMainWorld("riftlegends", {
	ping: () => ipcRenderer.invoke(pingChannel),
	window: {
		minimize: () => ipcRenderer.invoke(windowChannels.minimize),
		toggleMaximize: () => ipcRenderer.invoke(windowChannels.toggleMaximize),
		close: () => ipcRenderer.invoke(windowChannels.close),
		isMaximized: () => ipcRenderer.invoke(windowChannels.isMaximized),
		canMinimize: () => ipcRenderer.invoke(windowChannels.canMinimize),
		onMaximizedChange: (listener) => {
			const notify = (_event: IpcRendererEvent, maximized: boolean) =>
				listener(maximized);
			ipcRenderer.on(windowChannels.maximizedChange, notify);
			return () => {
				ipcRenderer.off(windowChannels.maximizedChange, notify);
			};
		},
	},
} satisfies RiftLegendsAPI);
