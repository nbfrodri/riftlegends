import { join } from "node:path";
import type { BrowserWindowConstructorOptions, WebContents } from "electron";
import { CREDIT_LINK_HOSTS } from "../shared/external-links";

export function createMainWindowOptions(): BrowserWindowConstructorOptions {
	return {
		title: "Rift Legends",
		frame: false,
		width: 1366,
		minWidth: 1280,
		minHeight: 720,
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
			CREDIT_LINK_HOSTS.includes(target.host) &&
			!target.username &&
			!target.password
		) {
			void openExternal(target.href).catch((error: unknown) => {
				console.error("Could not open the credits link", error);
			});
		}
		return { action: "deny" };
	});
}
