import type { BrowserWindow, IpcMain } from "electron";
import { coreChannels } from "../shared/bridge";
import type { CoreBridge } from "./core-bridge";

type Window = Pick<BrowserWindow, "once"> & {
	webContents: Pick<BrowserWindow["webContents"], "mainFrame" | "send">;
};

/**
 * Relays the renderer's core requests to the bridge. Only the window's main
 * frame may talk to the core; the core itself validates every message.
 */
export function registerCoreIpc(
	window: Window,
	ipc: Pick<IpcMain, "handle" | "removeHandler">,
	bridge: Pick<CoreBridge, "open" | "send" | "query" | "subscribe">,
	warn: (message: string) => void = console.warn,
) {
	const fromMainFrame = (channel: string, senderFrame: unknown) => {
		if (senderFrame !== window.webContents.mainFrame) {
			warn(`Rejected ${channel} from a frame other than the main one`);
			throw new Error(`${channel} requires the main frame`);
		}
	};

	ipc.handle(coreChannels.open, (event) => {
		fromMainFrame(coreChannels.open, event.senderFrame);
		return bridge.open();
	});
	ipc.handle(coreChannels.send, (event, body: string) => {
		fromMainFrame(coreChannels.send, event.senderFrame);
		return bridge.send(body);
	});
	ipc.handle(coreChannels.query, (event, body: string) => {
		fromMainFrame(coreChannels.query, event.senderFrame);
		return bridge.query(body);
	});

	const stop = bridge.subscribe((facts) =>
		window.webContents.send(coreChannels.facts, facts),
	);
	window.once("closed", () => {
		stop();
		for (const channel of [
			coreChannels.open,
			coreChannels.send,
			coreChannels.query,
		]) {
			ipc.removeHandler(channel);
		}
	});
}
