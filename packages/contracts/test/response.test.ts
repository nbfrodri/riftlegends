import { resources } from "@rift-legends/i18n";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES, errorKey, responseSchema } from "../index";

const response = responseSchema(z.strictObject({ type: z.literal("tick") }));

describe("response (C5)", () => {
	it("accepts an ok response with its position and facts", () => {
		const ok = { ok: true, position: 2, facts: [{ type: "tick" }] };
		expect(response.parse(ok)).toEqual(ok);
	});

	it("accepts an error response with a known code and params", () => {
		const error = {
			ok: false,
			error: { code: "stale-position", params: { expected: 3 } },
		};
		expect(response.parse(error)).toEqual(error);
	});

	it.each([
		[
			"an unknown error code",
			{ ok: false, error: { code: "boom", params: {} } },
		],
		[
			"an error with free text",
			{ ok: false, error: { code: "core-timeout", params: {}, message: "x" } },
		],
		["an ok response without position", { ok: true, facts: [] }],
		[
			"an ok response with an unknown fact",
			{ ok: true, position: 0, facts: [{ type: "tock" }] },
		],
		[
			"a response mixing both shapes",
			{
				ok: true,
				position: 0,
				facts: [],
				error: { code: "core-timeout", params: {} },
			},
		],
	])("rejects %s", (_, raw) => {
		expect(response.safeParse(raw).success).toBe(false);
	});
});

describe("error codes", () => {
	it.each(Object.entries(resources))(
		"have a translation in the %s catalog",
		(_, { translation }) => {
			for (const code of ERROR_CODES) {
				expect(translation, code).toHaveProperty([errorKey(code)]);
			}
		},
	);
});
