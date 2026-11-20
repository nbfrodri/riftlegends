import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	decodeFact,
	decodeLog,
	defineFacts,
	encodeFact,
	encodeLog,
	position,
} from "../index";

const facts = defineFacts({
	"test.pick": {
		game: position,
		team: z.enum(["blue", "red"]),
		champion: z.string(),
	},
	"test.result": {
		game: position,
		score: z.strictObject({ blue: z.int(), red: z.int() }),
		order: z.array(z.int()),
		decisive: z.boolean(),
	},
});

const pick = fc.record(
	{
		type: fc.constant("test.pick" as const),
		position: fc.nat(),
		game: fc.nat(),
		team: fc.constantFrom("blue" as const, "red" as const),
		champion: fc.string(),
	},
	{ noNullPrototype: true },
);
const result = fc.record(
	{
		type: fc.constant("test.result" as const),
		position: fc.nat(),
		game: fc.nat(),
		score: fc.record(
			{ blue: fc.integer(), red: fc.integer() },
			{ noNullPrototype: true },
		),
		order: fc.array(fc.integer()),
		decisive: fc.boolean(),
	},
	{ noNullPrototype: true },
);
const anyFact = fc.oneof(pick, result);

describe("canonical facts (C2)", () => {
	it("decode(encode(fact)) gives the same fact", () => {
		fc.assert(
			fc.property(anyFact, (fact) => {
				expect(decodeFact(facts, encodeFact(fact))).toEqual(fact);
			}),
		);
	});

	it("re-encoding a decoded fact gives the same bytes", () => {
		fc.assert(
			fc.property(anyFact, (fact) => {
				const line = encodeFact(fact);
				expect(encodeFact(decodeFact(facts, line))).toBe(line);
			}),
		);
	});

	it("encodes a fact as one line without spaces", () => {
		const line = encodeFact({
			type: "test.pick",
			position: 4,
			game: 1,
			team: "red",
			champion: "Veyra",
		});
		expect(line).toBe(
			'{"champion":"Veyra","game":1,"position":4,"team":"red","type":"test.pick"}',
		);
	});
});

describe("key order (C3)", () => {
	it("does not depend on how the object was built", () => {
		const a = {
			type: "test.result",
			position: 7,
			game: 2,
			score: { blue: 1, red: 0 },
			order: [3, 1],
			decisive: true,
		};
		const b = {
			decisive: true,
			order: [3, 1],
			score: { red: 0, blue: 1 },
			game: 2,
			position: 7,
			type: "test.result",
		};
		expect(encodeFact(b)).toBe(encodeFact(a));
	});

	it("keeps array order, which is meaningful", () => {
		const fact = (order: number[]) => ({
			type: "test.result",
			position: 0,
			game: 1,
			score: { blue: 0, red: 0 },
			order,
			decisive: false,
		});
		expect(encodeFact(fact([1, 2]))).not.toBe(encodeFact(fact([2, 1])));
	});
});

describe("rejections", () => {
	it.each([
		["a decimal", 1.5],
		["NaN", Number.NaN],
		["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
	])("cannot encode %s", (_, value) => {
		expect(() =>
			encodeFact({ type: "test.pick", position: value, game: 1 }),
		).toThrow();
	});

	it.each([
		["an unknown type", '{"position":0,"type":"test.nope"}'],
		[
			"an extra key",
			'{"champion":"A","extra":1,"game":1,"position":0,"team":"red","type":"test.pick"}',
		],
		[
			"a missing position",
			'{"champion":"A","game":1,"team":"red","type":"test.pick"}',
		],
		[
			"keys out of order",
			'{"game":1,"champion":"A","position":0,"team":"red","type":"test.pick"}',
		],
		[
			"extra whitespace",
			'{"champion": "A","game":1,"position":0,"team":"red","type":"test.pick"}',
		],
		["invalid JSON", "{"],
	])("cannot decode %s", (_, line) => {
		expect(() => decodeFact(facts, line)).toThrow();
	});
});

describe("logs", () => {
	it("write one LF-terminated line per fact and read them back", () => {
		fc.assert(
			fc.property(fc.array(anyFact), (list) => {
				const log = encodeLog(list);
				expect(log.split("\n")).toHaveLength(list.length + 1);
				expect(log.endsWith("\n") || log === "").toBe(true);
				expect(decodeLog(facts, log)).toEqual(list);
			}),
		);
	});

	it("rejects a log without the final LF", () => {
		const log = encodeLog([
			{
				type: "test.pick",
				position: 0,
				game: 1,
				team: "red",
				champion: "A",
			},
		]);
		expect(() => decodeLog(facts, log.slice(0, -1))).toThrow();
	});
});
