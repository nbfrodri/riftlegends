import { expect, test, vi } from "vitest";
import { registerWindowControls } from "../src/main/window-controls";
import { windowChannels } from "../src/shared/bridge";

type Handler = (event: { senderFrame: unknown }) => unknown;

function setup(maximized = false, canMinimize = true) {
	const mainFrame = { id: "main" };
	const listeners = new Map<string, () => void>();
	const state = { maximized };
	const window = {
		webContents: { mainFrame, send: vi.fn() },
		minimize: vi.fn(),
		maximize: vi.fn(() => {
			state.maximized = true;
		}),
		unmaximize: vi.fn(() => {
			state.maximized = false;
		}),
		close: vi.fn(),
		isMaximized: () => state.maximized,
		on: (name: string, listener: () => void) => listeners.set(name, listener),
		once: (name: string, listener: () => void) => listeners.set(name, listener),
	};
	const handlers = new Map<string, Handler>();
	const ipc = {
		handle: vi.fn((channel: string, handler: Handler) => {
			handlers.set(channel, handler);
		}),
		removeHandler: vi.fn((channel: string) => {
			handlers.delete(channel);
		}),
	};
	registerWindowControls(window as never, ipc as never, { canMinimize });
	const invoke = (channel: string, senderFrame: unknown = mainFrame) =>
		handlers.get(channel)?.({ senderFrame });
	return { window, ipc, handlers, listeners, invoke, mainFrame, state };
}

test("exposes the window channels", () => {
	const { handlers } = setup();
	expect([...handlers.keys()].sort()).toEqual(
		[
			windowChannels.canMinimize,
			windowChannels.close,
			windowChannels.isMaximized,
			windowChannels.minimize,
			windowChannels.toggleMaximize,
		].sort(),
	);
});

test("minimizes and closes the window", () => {
	const { window, invoke } = setup();
	invoke(windowChannels.minimize);
	invoke(windowChannels.close);
	expect(window.minimize).toHaveBeenCalledOnce();
	expect(window.close).toHaveBeenCalledOnce();
});

test("toggles between maximized and restored", () => {
	const { window, invoke } = setup();
	invoke(windowChannels.toggleMaximize);
	expect(window.maximize).toHaveBeenCalledOnce();
	expect(invoke(windowChannels.isMaximized)).toBe(true);
	invoke(windowChannels.toggleMaximize);
	expect(window.unmaximize).toHaveBeenCalledOnce();
	expect(invoke(windowChannels.isMaximized)).toBe(false);
});

test.each([
	["a subframe", { id: "iframe" }],
	["a destroyed frame", null],
])("rejects calls from %s", (_name, frame) => {
	const { window, handlers, invoke } = setup();
	for (const channel of handlers.keys()) {
		expect(() => invoke(channel, frame)).toThrow(/main frame/);
	}
	expect(window.minimize).not.toHaveBeenCalled();
	expect(window.maximize).not.toHaveBeenCalled();
	expect(window.close).not.toHaveBeenCalled();
});

test("publishes the maximized state when it changes", () => {
	const { window, listeners, state } = setup();
	state.maximized = true;
	listeners.get("maximize")?.();
	state.maximized = false;
	listeners.get("unmaximize")?.();
	expect(window.webContents.send.mock.calls).toEqual([
		[windowChannels.maximizedChange, true],
		[windowChannels.maximizedChange, false],
	]);
});

test("removes its handlers when the window closes", () => {
	const { handlers, listeners } = setup();
	listeners.get("closed")?.();
	expect(handlers.size).toBe(0);
});

test("reports whether the desktop supports minimizing", () => {
	expect(setup(false, false).invoke(windowChannels.canMinimize)).toBe(false);
	expect(setup(false, true).invoke(windowChannels.canMinimize)).toBe(true);
});
