import { expect, test, vi } from "vitest";
import { registerCoreIpc } from "../src/main/core-ipc";
import { coreChannels } from "../src/shared/bridge";

type Handler = (event: { senderFrame: unknown }, body?: string) => unknown;

function setup() {
	const mainFrame = { id: "main" };
	const closed: (() => void)[] = [];
	const window = {
		webContents: { mainFrame, send: vi.fn() },
		once: (_: "closed", listener: () => void) => closed.push(listener),
	};
	const handlers = new Map<string, Handler>();
	const ipc = {
		handle: (channel: string, handler: Handler) =>
			handlers.set(channel, handler),
		removeHandler: (channel: string) => handlers.delete(channel),
	};
	let push: ((facts: readonly { position: number }[]) => void) | undefined;
	const bridge = {
		open: vi.fn(async () => ({ ok: true, sessionId: 1 })),
		send: vi.fn(async (body: string) => ({
			ok: true,
			position: 0,
			facts: [],
			body,
		})),
		query: vi.fn(async () => ({ ok: true, view: {} })),
		subscribe: vi.fn((listener: typeof push) => {
			push = listener;
			return () => {
				push = undefined;
			};
		}),
	};
	const warn = vi.fn();
	registerCoreIpc(window as never, ipc as never, bridge as never, warn);
	const invoke = (
		channel: string,
		body?: string,
		senderFrame: unknown = mainFrame,
	) => handlers.get(channel)?.({ senderFrame }, body);
	return { window, handlers, bridge, invoke, push: () => push, closed, warn };
}

test("forwards open, send and query from the main frame", async () => {
	const { invoke, bridge } = setup();
	await invoke(coreChannels.open);
	await invoke(coreChannels.send, "cmd");
	await invoke(coreChannels.query, "q");
	expect(bridge.open).toHaveBeenCalledOnce();
	expect(bridge.send).toHaveBeenCalledWith("cmd");
	expect(bridge.query).toHaveBeenCalledWith("q");
});

test("rejects and logs requests from another frame (P3)", async () => {
	const { invoke, bridge, warn } = setup();
	for (const channel of [
		coreChannels.open,
		coreChannels.send,
		coreChannels.query,
	]) {
		await expect(
			Promise.resolve().then(() => invoke(channel, "x", { id: "iframe" })),
		).rejects.toThrow();
	}
	expect(bridge.open).not.toHaveBeenCalled();
	expect(bridge.send).not.toHaveBeenCalled();
	expect(warn).toHaveBeenCalledTimes(3);
});

test("pushes facts to the window and stops when it closes", () => {
	const { window, push, closed, handlers } = setup();
	push()?.([{ position: 0 }]);
	expect(window.webContents.send).toHaveBeenCalledWith(coreChannels.facts, [
		{ position: 0 },
	]);
	for (const listener of closed) listener();
	expect(push()).toBeUndefined();
	expect(handlers.size).toBe(0);
});
