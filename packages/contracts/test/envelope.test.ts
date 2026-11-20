import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	CONTRACT_VERSION,
	defineCommands,
	defineQueries,
	parseCommand,
	parseQuery,
} from "../index";

const commands = defineCommands({
	"test.ping": z.strictObject({ count: z.int() }),
	"test.reset": z.strictObject({}),
});

const command = (overrides: Record<string, unknown> = {}) => ({
	v: CONTRACT_VERSION,
	kind: "test.ping",
	sessionId: 1,
	expectedPosition: 0,
	payload: { count: 3 },
	...overrides,
});

const rejection = (raw: unknown) => {
	const result = parseCommand(commands, raw);
	if (result.ok) throw new Error("expected a rejection");
	return result.error;
};

describe("command envelope (C1)", () => {
	it("accepts a valid envelope and keeps its discriminated kind", () => {
		const result = parseCommand(commands, command());
		expect(result).toEqual({ ok: true, command: command() });
		if (result.ok && result.command.kind === "test.ping") {
			// Narrowing by kind gives the payload its own type.
			expect(result.command.payload.count).toBe(3);
		}
	});

	it.each([
		["an unknown kind", command({ kind: "test.unknown" }), ["kind"]],
		["an extra envelope field", command({ extra: true }), []],
		[
			"an extra payload field",
			command({ payload: { count: 3, x: 1 } }),
			["payload"],
		],
		["a missing payload", command({ payload: undefined }), ["payload"]],
		[
			"a payload of the wrong type",
			command({ payload: { count: "3" } }),
			["payload", "count"],
		],
		["a missing session", command({ sessionId: undefined }), ["sessionId"]],
	])("rejects %s with the path of the error", (_, raw, path) => {
		const error = rejection(raw);
		expect(error.code).toBe("invalid-command");
		expect(error.params.path).toBe(path.join("."));
	});

	it("rejects values that are not objects", () => {
		for (const raw of [null, "ping", 42, []]) {
			expect(rejection(raw).code).toBe("invalid-command");
		}
	});
});

describe("integers (C4)", () => {
	it.each([
		["NaN", Number.NaN],
		["Infinity", Number.POSITIVE_INFINITY],
		["a decimal", 1.5],
		["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
		["a negative position", -1],
	])("rejects %s as a position", (_, value) => {
		expect(rejection(command({ expectedPosition: value })).code).toBe(
			"invalid-command",
		);
	});

	it("accepts the largest safe integer", () => {
		const raw = command({ expectedPosition: Number.MAX_SAFE_INTEGER });
		expect(parseCommand(commands, raw).ok).toBe(true);
	});
});

describe("contract version (C6)", () => {
	it("rejects another version before checking anything else", () => {
		const error = rejection({ v: CONTRACT_VERSION + 1, kind: "nope" });
		expect(error).toEqual({
			code: "contract-mismatch",
			params: { expected: CONTRACT_VERSION, received: CONTRACT_VERSION + 1 },
		});
	});

	it("treats a missing version as a mismatch", () => {
		expect(rejection({ ...command(), v: undefined }).code).toBe(
			"contract-mismatch",
		);
	});
});

describe("query envelope", () => {
	const queries = defineQueries({
		"test.view": z.strictObject({ page: z.int().nonnegative() }),
	});
	const query = {
		v: CONTRACT_VERSION,
		kind: "test.view",
		sessionId: 1,
		params: { page: 0 },
	};

	it("accepts a valid query", () => {
		expect(parseQuery(queries, query)).toEqual({ ok: true, query });
	});

	it("rejects a query with a command field", () => {
		const result = parseQuery(queries, { ...query, expectedPosition: 0 });
		expect(result.ok).toBe(false);
	});
});
