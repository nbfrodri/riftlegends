import { expect, test, vi } from "vitest";
import { registerAssetIpc } from "./ipc";

test("validates the sender and rejects any arguments before handling asset IPC", async () => {
	const mainFrame = {};
	const handlers = new Map<
		string,
		(event: { senderFrame: unknown }, ...args: unknown[]) => unknown
	>();
	const window = {
		webContents: { mainFrame, send: vi.fn() },
		once: vi.fn(),
	};
	const ipc = {
		handle: (
			channel: string,
			handler: NonNullable<ReturnType<typeof handlers.get>>,
		) => handlers.set(channel, handler),
		removeHandler: (channel: string) => handlers.delete(channel),
	};
	const cache = {
		getStatus: vi.fn(() => ({ state: "missing" as const })),
		sync: vi.fn(async () => ({ state: "missing" as const })),
		subscribe: vi.fn(() => () => {}),
	};
	registerAssetIpc(window as never, ipc as never, cache);
	for (const channel of ["assets:status", "assets:sync"]) {
		const handle = handlers.get(channel);
		expect(handle).toBeDefined();
		expect(() => handle?.({ senderFrame: {} })).toThrow(
			"requires the main frame",
		);
		expect(() => handle?.({ senderFrame: mainFrame }, undefined)).toThrow(
			"takes no arguments",
		);
		expect(() =>
			handle?.({ senderFrame: mainFrame }, { path: "ignored" }),
		).toThrow("takes no arguments");
	}
	expect(cache.getStatus).not.toHaveBeenCalled();
	expect(cache.sync).not.toHaveBeenCalled();
	await expect(
		handlers.get("assets:sync")?.({ senderFrame: mainFrame }),
	).resolves.toEqual({
		state: "missing",
	});
});
