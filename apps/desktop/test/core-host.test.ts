import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { packagedDraftContent } from "@rift-legends/core";
import { describe, expect, it } from "vitest";
import { createCoreHost, MAX_MESSAGE_BYTES } from "../src/core-host/host";

const tick = (sessionId: number, expectedPosition: number) =>
	JSON.stringify({
		v: CONTRACT_VERSION,
		kind: "debug.tick",
		sessionId,
		expectedPosition,
		payload: {},
	});

const open = (host: ReturnType<typeof createCoreHost>) => {
	const reply = host.receive({ id: 1, op: "open" });
	if (!reply.result.ok || !("sessionId" in reply.result)) {
		throw new Error("could not open a session");
	}
	return reply.result.sessionId;
};

describe("core host", () => {
	it("opens a session and applies commands in order", () => {
		const host = createCoreHost();
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
		const host = createCoreHost();
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
		const reply = createCoreHost().receive({
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

const draftMessage = (
	kind: string,
	sessionId: number,
	expectedPosition: number,
	payload: object,
) => ({
	id: 10,
	op: "send" as const,
	body: JSON.stringify({
		v: CONTRACT_VERSION,
		kind,
		sessionId,
		expectedPosition,
		payload,
	}),
});

describe("draft sessions (plan 09, Q1)", () => {
	const POOL = packagedDraftContent.champions.map((c) => c.id);
	const start = {
		teams: ["forge", "shoal"],
		seeds: [1, 2],
		format: "bo1",
		fearless: "off",
		timer: false,
		pool: POOL,
		seed: 5,
		ai: [null, "coach"],
	};

	it("starts a series with the packaged content and bans a champion", () => {
		const host = createCoreHost();
		const sessionId = open(host);
		expect(
			host.receive(draftMessage("series.start", sessionId, 0, start)).result,
		).toMatchObject({ ok: true, position: 1 });
		const chosen = host.receive(
			draftMessage("side.choose", sessionId, 1, {
				team: "forge",
				side: "blue",
			}),
		);
		expect(chosen.result).toMatchObject({ ok: true, position: 3 });
		const banned = host.receive(
			draftMessage("draft.ban", sessionId, 3, {
				team: "forge",
				champion: POOL[0],
			}),
		);
		expect(banned.result).toMatchObject({
			ok: true,
			facts: [{ type: "draft.banned", champion: POOL[0] }],
		});
		// The AI team reads its coach from the packaged content.
		const ai = host.receive(draftMessage("draft.ai", sessionId, 4, {}));
		expect(ai.result).toMatchObject({
			ok: true,
			facts: [{ type: "ai.decided", team: "shoal" }, { type: "draft.banned" }],
		});
	});

	it("offers and starts a series with the real content (plan 11)", () => {
		const host = createCoreHost();
		const sessionId = open(host);
		const options = host.receive({
			id: 12,
			op: "query",
			body: JSON.stringify({
				v: CONTRACT_VERSION,
				kind: "series.options",
				sessionId,
				params: { content: "real" },
			}),
		}).result as {
			ok: true;
			view: { teams: { id: string }[]; pool: string[] };
		};
		expect(options.view.teams).toHaveLength(60);
		const [a, b] = options.view.teams;
		expect(
			host.receive(
				draftMessage("series.start", sessionId, 0, {
					...start,
					teams: [a?.id, b?.id],
					pool: options.view.pool,
					content: "real",
				}),
			).result,
		).toMatchObject({
			ok: true,
			facts: [{ type: "series.started", content: "real" }],
		});
	});

	it("answers draft.view and match.view", () => {
		const host = createCoreHost();
		const sessionId = open(host);
		host.receive(draftMessage("series.start", sessionId, 0, start));
		const query = (kind: string, params: object) =>
			host.receive({
				id: 11,
				op: "query",
				body: JSON.stringify({ v: CONTRACT_VERSION, kind, sessionId, params }),
			}).result;
		expect(query("draft.view", {})).toMatchObject({
			ok: true,
			view: { game: 1, phase: "side" },
		});
		expect(query("match.view", { game: 1 })).toMatchObject({
			ok: false,
			error: { code: "game-not-played" },
		});
	});

	it("rejects an invalid command and one for another session", () => {
		const host = createCoreHost();
		const sessionId = open(host);
		host.receive(draftMessage("series.start", sessionId, 0, start));
		expect(
			host.receive(draftMessage("draft.ban", sessionId, 1, { team: "forge" }))
				.result,
		).toMatchObject({ ok: false, error: { code: "invalid-command" } });
		expect(
			host.receive(draftMessage("series.start", 99, 0, start)).result,
		).toMatchObject({ ok: false, error: { code: "unknown-session" } });
		// A well-formed ban in the wrong phase is the domain's to reject.
		expect(
			host.receive(
				draftMessage("draft.ban", sessionId, 1, {
					team: "forge",
					champion: POOL[0],
				}),
			).result,
		).toMatchObject({ ok: false, error: { code: "wrong-action" } });
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
		const host = createCoreHost();
		open(host);
		expect(host.receive(message).result).toMatchObject(invalid);
	});

	it("answers a message without id with id null", () => {
		const reply = createCoreHost().receive("ping");
		expect(reply).toMatchObject({ id: null, result: invalid });
	});
});
