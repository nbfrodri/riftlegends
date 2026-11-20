import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { createDebugHost, MAX_MESSAGE_BYTES } from "../src/core-host/host";

const tick = (sessionId: number, expectedPosition: number) =>
	JSON.stringify({
		v: CONTRACT_VERSION,
		kind: "debug.tick",
		sessionId,
		expectedPosition,
		payload: {},
	});

const open = (host: ReturnType<typeof createDebugHost>) => {
	const reply = host.receive({ id: 1, op: "open" });
	if (!reply.result.ok || !("sessionId" in reply.result)) {
		throw new Error("could not open a session");
	}
	return reply.result.sessionId;
};

describe("core host", () => {
	it("opens a session and applies commands in order", () => {
		const host = createDebugHost();
		const sessionId = open(host);
		expect(
			host.receive({ id: 2, op: "send", body: tick(sessionId, 0) }),
		).toEqual({
			id: 2,
			result: {
				ok: true,
				position: 1,
				facts: [{ type: "debug.ticked", position: 0, count: 1 }],
			},
		});
		const second = host.receive({
			id: 3,
			op: "send",
			body: tick(sessionId, 1),
		});
		expect(second.result).toMatchObject({ ok: true, position: 2 });
	});

	it("answers queries", () => {
		const host = createDebugHost();
		const sessionId = open(host);
		const body = JSON.stringify({
			v: CONTRACT_VERSION,
			kind: "debug.count",
			sessionId,
			params: {},
		});
		expect(host.receive({ id: 4, op: "query", body })).toEqual({
			id: 4,
			result: { ok: true, view: { count: 0 } },
		});
	});

	it("rejects a session it does not know", () => {
		const reply = createDebugHost().receive({
			id: 5,
			op: "send",
			body: tick(99, 0),
		});
		expect(reply.result).toEqual({
			ok: false,
			error: { code: "unknown-session", params: { sessionId: 99 } },
		});
	});
});

describe("malformed messages (P2)", () => {
	const invalid = { ok: false, error: { code: "invalid-command" } };

	it.each([
		["a body that is not JSON", { id: 6, op: "send", body: "{" }],
		["a binary body", { id: 6, op: "send", body: new Uint8Array([1, 2]) }],
		["an unknown operation", { id: 6, op: "drop" }],
		[
			"a body over the size limit",
			{ id: 6, op: "send", body: `"${"x".repeat(MAX_MESSAGE_BYTES)}"` },
		],
		["a command with the wrong shape", { id: 6, op: "send", body: '{"v":1}' }],
	])("rejects %s without reaching the domain", (_, message) => {
		const host = createDebugHost();
		open(host);
		expect(host.receive(message).result).toMatchObject(invalid);
	});

	it("answers a message without id with id null", () => {
		const reply = createDebugHost().receive("ping");
		expect(reply).toMatchObject({ id: null, result: invalid });
	});
});
