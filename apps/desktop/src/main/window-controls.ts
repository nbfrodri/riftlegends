import type { BrowserWindow, IpcMain } from "electron";
import { windowChannels } from "../shared/bridge";

export function registerWindowControls(
	window: BrowserWindow,
	ipc: Pick<IpcMain, "handle" | "removeHandler">,
) {
	const actions = {
		[windowChannels.minimize]: () => window.minimize(),
		[windowChannels.toggleMaximize]: () => {
			if (window.isMaximized()) window.unmaximize();
			else window.maximize();
		},
		[windowChannels.close]: () => window.close(),
		[windowChannels.isMaximized]: () => window.isMaximized(),
	};
	for (const [channel, action] of Object.entries(actions)) {
		ipc.handle(channel, (event) => {
			if (event.senderFrame !== window.webContents.mainFrame) {
				throw new Error("Window controls require the main frame");
			}
			return action();
		});
	}
	const publishState = () => {
		window.webContents.send(
			windowChannels.maximizedChange,
			window.isMaximized(),
		);
	};
	window.on("maximize", publishState);
	window.on("unmaximize", publishState);
	window.once("closed", () => {
		for (const channel of Object.keys(actions)) ipc.removeHandler(channel);
	});
}
