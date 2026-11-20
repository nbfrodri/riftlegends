import { beforeEach, expect, test, vi } from "vitest";
import { pingChannel } from "../src/shared/bridge";

const session = {
	setPermissionCheckHandler: vi.fn(),
	setPermissionRequestHandler: vi.fn(),
};
const mainFrame = {};
const loadRenderer = vi.fn();
const handlers = new Map<
	string,
	(event: { senderFrame: unknown }) => unknown
>();

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	handlers.clear();
	vi.doMock("electron", () => ({
		app: {
			whenReady: () => Promise.resolve(),
			on: vi.fn(),
			once: vi.fn(),
			getLocale: () => "en-US",
		},
		utilityProcess: {
			fork: () => ({ on: vi.fn(), postMessage: vi.fn(), kill: vi.fn() }),
		},
		BrowserWindow: class {
			webContents = {
				session,
				mainFrame,
				on: vi.fn(),
				setWindowOpenHandler: vi.fn(),
			};
			on = vi.fn();
			once = vi.fn();
			loadFile = loadRenderer;
			loadURL = loadRenderer;
		},
		ipcMain: { handle: handlers.set.bind(handlers) },
		shell: { openExternal: vi.fn() },
	}));
	// electron-vite turns this import into a path; Vitest would run the module.
	vi.doMock("../src/core-host/index?modulePath", () => ({
		default: "core.js",
	}));
	await import("../src/main/index");
});

test.each(["notifications", "media"])(
	"denies %s checks before loading the renderer",
	(permission) => {
		expect(session.setPermissionCheckHandler).toHaveBeenCalledBefore(
			loadRenderer,
		);
		const check = session.setPermissionCheckHandler.mock.calls[0]?.[0];
		expect(check(null, permission, "file://", {})).toBe(false);
	},
);

test.each(["notifications", "media"])(
	"denies %s requests before loading the renderer",
	(permission) => {
		expect(session.setPermissionRequestHandler).toHaveBeenCalledBefore(
			loadRenderer,
		);
		const request = session.setPermissionRequestHandler.mock.calls[0]?.[0];
		const reply = vi.fn();
		request(null, permission, reply, {});
		expect(reply).toHaveBeenCalledExactlyOnceWith(false);
	},
);

test.each([{}, null])(
	"rejects ping from a foreign or destroyed frame",
	(senderFrame) => {
		const ping = handlers.get(pingChannel);
		expect(ping?.({ senderFrame: mainFrame })).toBe("pong");
		expect(() => ping?.({ senderFrame })).toThrow(/main frame/);
	},
);
