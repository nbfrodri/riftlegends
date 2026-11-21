import type { IpcRenderer, IpcRendererEvent } from "electron";
import { type CoreApi, type CoreFact, coreChannels } from "../shared/bridge";

/**
 * The core API for the renderer. Messages travel as JSON text, so the core
 * parses exactly what the renderer sent; the IPC event never reaches it.
 */
export const createCoreApi = (
	ipc: Pick<IpcRenderer, "invoke" | "on" | "off">,
): CoreApi => ({
	open: () => ipc.invoke(coreChannels.open),
	send: (command) => ipc.invoke(coreChannels.send, JSON.stringify(command)),
	query: (query) => ipc.invoke(coreChannels.query, JSON.stringify(query)),
	subscribe(listener) {
		const notify = (_event: IpcRendererEvent, facts: readonly CoreFact[]) =>
			listener(facts);
		ipc.on(coreChannels.facts, notify);
		return () => {
			ipc.off(coreChannels.facts, notify);
		};
	},
});
