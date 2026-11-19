import { join } from "node:path";
import type { BrowserWindowConstructorOptions, WebContents } from "electron";

export function createMainWindowOptions(): BrowserWindowConstructorOptions {
	return {
		title: "Rift Legends",
		frame: false,
		width: 1366,
		height: 768,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
		},
	};
}

export function secureNavigation(
	contents: Pick<WebContents, "on" | "setWindowOpenHandler">,
	openExternal: (url: string) => Promise<void>,
) {
	contents.on("will-navigate", (event) => event.preventDefault());
	contents.setWindowOpenHandler(({ url }) => {
		const target = URL.parse(url);
		if (
			target?.protocol === "https:" &&
			target.host === "lol.fandom.com" &&
			!target.username &&
			!target.password
		) {
			void openExternal(target.href).catch((error: unknown) => {
				console.error("Could not open the attribution link", error);
			});
		}
		return { action: "deny" };
	});
}
