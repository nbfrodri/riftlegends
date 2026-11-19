import type { BrowserWindow, IpcMain } from "electron";
import { systemLocaleChannel } from "../shared/bridge";

/** Answers the renderer's request for the system locale (`app.getLocale()`). */
export function registerSystemLocale(
	window: Pick<BrowserWindow, "webContents" | "once">,
	ipc: Pick<IpcMain, "handle" | "removeHandler">,
	locale: string,
) {
	ipc.handle(systemLocaleChannel, (event) => {
		if (event.senderFrame !== window.webContents.mainFrame) {
			throw new Error("The system locale requires the main frame");
		}
		return locale;
	});
	window.once("closed", () => ipc.removeHandler(systemLocaleChannel));
}
