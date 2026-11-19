export const pingChannel = "riftlegends:ping";
export const systemLocaleChannel = "app:system-locale";

export const windowChannels = {
	minimize: "window:minimize",
	toggleMaximize: "window:toggle-maximize",
	close: "window:close",
	isMaximized: "window:is-maximized",
	canMinimize: "window:can-minimize",
	maximizedChange: "window:maximized-change",
} as const;

export interface WindowControls {
	minimize(): Promise<void>;
	toggleMaximize(): Promise<void>;
	close(): Promise<void>;
	isMaximized(): Promise<boolean>;
	/** False on window managers that ignore minimize requests (tiling Wayland compositors). */
	canMinimize(): Promise<boolean>;
	onMaximizedChange(listener: (maximized: boolean) => void): () => void;
}

export interface RiftLegendsAPI {
	ping(): Promise<"pong">;
	/** The system locale reported by Electron (`app.getLocale()`), e.g. "es-ES". */
	systemLocale(): Promise<string>;
	window: WindowControls;
}

declare global {
	interface Window {
		readonly riftlegends: RiftLegendsAPI;
	}
}
