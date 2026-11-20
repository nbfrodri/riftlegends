import { CONTRACT_VERSION } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createDispatcher, openSession, type Session } from "./dispatcher";

// A toy domain: a counter that only accepts positive additions.
type Toy = { total: number; history: readonly number[] };

const toy = createDispatcher<Toy>({
	commands: {
		"toy.add": (state, { n }: { n: number }) =>
			n > 0
				? {
						ok: true,
						state: { total: state.total + n, history: [...state.history, n] },
						facts: [{ type: "toy.added", n, total: state.total + n }],
					}
				: { ok: false, error: { code: "invalid-command", params: { n } } },
		"toy.double": (state) => ({
			ok: true,
			state: { total: state.total * 2, history: [...state.history, 0] },
			facts: [
				{ type: "toy.doubling", from: state.total },
				{ type: "toy.doubled", total: state.total * 2 },
			],
		}),
	},
	queries: {
		"toy.total": (state) => ({ total: state.total }),
	},
});

const start = (): Session<Toy> => openSession(7, { total: 0, history: [] });

const add = (session: Session<Toy>, n: number, at = session.position) => ({
	v: CONTRACT_VERSION,
	kind: "toy.add",
	sessionId: session.id,
	expectedPosition: at,
	payload: { n },
});

const double = (session: Session<Toy>) => ({
	v: CONTRACT_VERSION,
	kind: "toy.double",
	sessionId: session.id,
	expectedPosition: session.position,
	payload: {},
});

const deepFreeze = <T>(value: T): T => {
	if (typeof value === "object" && value !== null) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
};

describe("handle (N1)", () => {
	it("returns the new state and facts without touching its input", () => {
		const session = deepFreeze(start());
		const command = deepFreeze(add(session, 3));
		const { session: next, response } = toy.handle(session, command);
		expect(response).toEqual({
			ok: true,
			position: 1,
			facts: [{ type: "toy.added", position: 0, n: 3, total: 3 }],
		});
		expect(next.state).toEqual({ total: 3, history: [3] });
		expect(session.state).toEqual({ total: 0, history: [] });
	});
});

describe("rejections (N2)", () => {
	it("leave the session exactly as it was", () => {
		const session = start();
		const { session: next, response } = toy.handle(session, add(session, -1));
		expect(response).toEqual({
			ok: false,
			error: { code: "invalid-command", params: { n: -1 } },
		});
		expect(next).toBe(session);
	});

	it("do not change what the valid commands produce", () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: -3, max: 5 })), (numbers) => {
				const run = (list: number[]) => {
					let session = start();
					const facts: unknown[] = [];
					for (const n of list) {
						const result = toy.handle(session, add(session, n));
						session = result.session;
						if (result.response.ok) facts.push(...result.response.facts);
					}
					return { state: session.state, position: session.position, facts };
				};
				expect(run(numbers)).toEqual(run(numbers.filter((n) => n > 0)));
			}),
		);
	});
});

describe("positions (N3)", () => {
	it("are consecutive, without gaps or repeats", () => {
		const commands = fc.array(
			fc.oneof(fc.integer({ min: -2, max: 3 }), fc.constant("double" as const)),
			{
				minLength: 1000,
				maxLength: 1000,
			},
		);
		fc.assert(
			fc.property(commands, (list) => {
				let session = start();
				const positions: number[] = [];
				for (const item of list) {
					const command =
						item === "double" ? double(session) : add(session, item);
					const result = toy.handle(session, command);
					session = result.session;
					if (result.response.ok) {
						positions.push(
							...result.response.facts.map((fact) => fact.position),
						);
					}
				}
				expect(positions).toEqual(positions.map((_, index) => index));
				expect(session.position).toBe(positions.length);
			}),
			{ numRuns: 20 },
		);
	});
});

describe("retries (N4)", () => {
	it("answer the same facts without applying the command again", () => {
		const first = toy.handle(start(), add(start(), 2));
		const retry = toy.handle(first.session, add(start(), 2));
		expect(retry.response).toEqual(first.response);
		expect(retry.session).toBe(first.session);
	});

	it("reject another command sent for a position already used", () => {
		const { session } = toy.handle(start(), add(start(), 2));
		const { response } = toy.handle(session, add(session, 5, 0));
		expect(response).toEqual({
			ok: false,
			error: { code: "stale-position", params: { expected: 1 } },
		});
	});

	it("reject a position ahead of the session", () => {
		const session = start();
		const { response, session: next } = toy.handle(session, add(session, 1, 3));
		expect(response).toMatchObject({
			ok: false,
			error: { code: "stale-position" },
		});
		expect(next).toBe(session);
	});

	it("only remember the last command", () => {
		let { session } = toy.handle(start(), add(start(), 1));
		({ session } = toy.handle(session, add(session, 1)));
		const { response } = toy.handle(session, add(session, 1, 0));
		expect(response).toMatchObject({
			ok: false,
			error: { code: "stale-position" },
		});
	});

	it("reject a command for another session", () => {
		const session = start();
		const { response } = toy.handle(session, {
			...add(session, 1),
			sessionId: 8,
		});
		expect(response).toEqual({
			ok: false,
			error: { code: "unknown-session", params: { sessionId: 8 } },
		});
	});
});

describe("queries (N5)", () => {
	it("read the state without changing it or emitting facts", () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: 1, max: 9 })), (numbers) => {
				let session = start();
				for (const n of numbers) {
					const before = session;
					expect(
						toy.query(session, {
							v: CONTRACT_VERSION,
							kind: "toy.total",
							sessionId: session.id,
							params: {},
						}),
					).toEqual({ ok: true, view: { total: session.state.total } });
					expect(session).toBe(before);
					session = toy.handle(session, add(session, n)).session;
				}
			}),
		);
	});
});
