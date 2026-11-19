import { contextBridge, ipcRenderer } from "electron";
import { pingChannel, type RiftLegendsAPI } from "../shared/bridge";

contextBridge.exposeInMainWorld("riftlegends", {
	ping: () => ipcRenderer.invoke(pingChannel),
} satisfies RiftLegendsAPI);
