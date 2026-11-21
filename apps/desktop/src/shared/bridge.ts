import type { CoreError, Response } from "@rift-legends/contracts";

export const pingChannel = "riftlegends:ping";
export const systemLocaleChannel = "app:system-locale";

/** IPC channels between the renderer and the core (plan 04). */
export const coreChannels = {
	open: "core:open",
	send: "core:send",
	query: "core:query",
	facts: "core:facts",
} as const;

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

/** A fact as the core emits it; its other keys depend on its `type`. */
export type CoreFact = { readonly type: string; readonly position: number } & {
	readonly [key: string]: unknown;
};

type Failure = { ok: false; error: CoreError };

/** A command envelope; `packages/contracts` validates it in the core. */
export interface CoreCommand {
	readonly v: number;
	readonly kind: string;
	readonly sessionId: number;
	readonly expectedPosition: number;
	readonly payload: unknown;
}

export interface CoreQuery {
	readonly v: number;
	readonly kind: string;
	readonly sessionId: number;
	readonly params: unknown;
}

/** The renderer's only way to talk to the core (plan 04, R1). */
export interface CoreApi {
	open(): Promise<{ ok: true; sessionId: number } | Failure>;
	send(command: CoreCommand): Promise<Response<CoreFact>>;
	query(query: CoreQuery): Promise<{ ok: true; view: unknown } | Failure>;
	/** Facts of every accepted command, in order. Returns the unsubscribe. */
	subscribe(listener: (facts: readonly CoreFact[]) => void): () => void;
}

export interface RiftLegendsAPI {
	ping(): Promise<"pong">;
	/** The system locale reported by Electron (`app.getLocale()`), e.g. "es-ES". */
	systemLocale(): Promise<string>;
	window: WindowControls;
	core: CoreApi;
}

declare global {
	interface Window {
		readonly riftlegends: RiftLegendsAPI;
	}
}
