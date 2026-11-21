import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { expect, test, vi } from "vitest";
import { createCoreApi } from "../src/preload/core";
import { coreChannels } from "../src/shared/bridge";

type Listener = (event: unknown, facts: unknown) => void;

function setup() {
	const listeners = new Set<Listener>();
	const ipc = {
		invoke: vi.fn(async (_channel: string, _body?: string) => ({ ok: true })),
		on: vi.fn((_channel: string, listener: Listener) => {
			listeners.add(listener);
		}),
		off: vi.fn((_channel: string, listener: Listener) => {
			listeners.delete(listener);
		}),
	};
	const emit = (facts: unknown) => {
		for (const listener of [...listeners]) listener({}, facts);
	};
	return { ipc, emit, api: createCoreApi(ipc as never) };
}

const command = {
	v: CONTRACT_VERSION,
	kind: "debug.tick",
	sessionId: 1,
	expectedPosition: 0,
	payload: {},
} as const;

test("exposes only open, send, query and subscribe (R1)", () => {
	const { api } = setup();
	expect(Object.keys(api).sort()).toEqual([
		"open",
		"query",
		"send",
		"subscribe",
	]);
	for (const value of Object.values(api)) expect(typeof value).toBe("function");
});

test("sends commands and queries as JSON on their own channels", async () => {
	const { api, ipc } = setup();
	await api.open();
	await api.send(command);
	await api.query({
		v: CONTRACT_VERSION,
		kind: "debug.count",
		sessionId: 1,
		params: {},
	});
	expect(ipc.invoke.mock.calls).toEqual([
		[coreChannels.open],
		[coreChannels.send, JSON.stringify(command)],
		[
			coreChannels.query,
			JSON.stringify({
				v: CONTRACT_VERSION,
				kind: "debug.count",
				sessionId: 1,
				params: {},
			}),
		],
	]);
});

test("passes facts to subscribers until they unsubscribe", () => {
	const { api, emit } = setup();
	const seen: unknown[] = [];
	const stop = api.subscribe((facts) => seen.push(facts));
	const facts = [{ type: "debug.ticked", position: 0 }];
	emit(facts);
	stop();
	emit(facts);
	expect(seen).toEqual([facts]);
});

test("does not hand the IPC event to the renderer", () => {
	const { api, emit } = setup();
	const listener = vi.fn();
	api.subscribe(listener);
	emit([]);
	expect(listener).toHaveBeenCalledWith([]);
	expect(listener.mock.calls[0]).toHaveLength(1);
});
