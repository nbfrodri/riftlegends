import {
	type CommandCatalog,
	type CoreError,
	debugCommands,
	debugQueries,
	parseCommand,
	parseQuery,
	type QueryCatalog,
	type Response,
} from "@rift-legends/contracts";
import {
	type createDispatcher,
	debugDispatcher,
	type Fact,
	initialDebugState,
	openSession,
	type Session,
} from "@rift-legends/core";

/** Larger messages are rejected before parsing (plan 04, P2). */
export const MAX_MESSAGE_BYTES = 1024 * 1024;

/** What main sends to the core process. */
export type HostRequest =
	| { id: number; op: "open" }
	| { id: number; op: "send" | "query"; body: string };

export type HostResult =
	| { ok: true; sessionId: number }
	| Response<Fact>
	| { ok: true; view: unknown }
	| { ok: false; error: CoreError };

export interface HostReply {
	id: number | null;
	result: HostResult;
}

const invalid = (path: string): HostResult => ({
	ok: false,
	error: { code: "invalid-command", params: { path } },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const readBody = (body: unknown): unknown => {
	if (typeof body !== "string") throw new Error("body");
	if (new TextEncoder().encode(body).length > MAX_MESSAGE_BYTES) {
		throw new Error("size");
	}
	return JSON.parse(body);
};

// biome-ignore lint/suspicious/noExplicitAny: catalogs and dispatchers are checked where they are built
type AnyCatalog = any;

/**
 * The core's side of the IPC: validates every message, owns the sessions and
 * runs the dispatcher. Messages are handled one at a time, in arrival order.
 */
export const createHost = <S>(definition: {
	commands: CommandCatalog<AnyCatalog>;
	queries: QueryCatalog<AnyCatalog>;
	dispatcher: ReturnType<typeof createDispatcher<S>>;
	initialState: () => S;
}) => {
	const sessions = new Map<number, Session<S>>();
	let nextSessionId = 1;

	const unknownSession = (sessionId: number): HostResult => ({
		ok: false,
		error: { code: "unknown-session", params: { sessionId } },
	});

	const run = (message: Record<string, unknown>): HostResult => {
		if (message.op === "open") {
			const sessionId = nextSessionId++;
			sessions.set(
				sessionId,
				openSession(sessionId, definition.initialState()),
			);
			return { ok: true, sessionId };
		}
		if (message.op !== "send" && message.op !== "query") return invalid("op");

		let raw: unknown;
		try {
			raw = readBody(message.body);
		} catch {
			return invalid("body");
		}

		if (message.op === "query") {
			const parsed = parseQuery(definition.queries, raw);
			if (!parsed.ok) return parsed;
			const session = sessions.get(parsed.query.sessionId);
			if (!session) return unknownSession(parsed.query.sessionId);
			return definition.dispatcher.query(session, parsed.query);
		}

		const parsed = parseCommand(definition.commands, raw);
		if (!parsed.ok) return parsed;
		const session = sessions.get(parsed.command.sessionId);
		if (!session) return unknownSession(parsed.command.sessionId);
		const { session: next, response } = definition.dispatcher.handle(
			session,
			parsed.command,
		);
		sessions.set(next.id, next);
		return response;
	};

	return {
		receive(message: unknown): HostReply {
			if (!isRecord(message) || !Number.isSafeInteger(message.id)) {
				return { id: null, result: invalid("id") };
			}
			return { id: message.id as number, result: run(message) };
		},
	};
};

/** Host with the debug catalog, used until the draft commands exist. */
export const createDebugHost = () =>
	createHost({
		commands: debugCommands,
		queries: debugQueries,
		dispatcher: debugDispatcher,
		initialState: () => initialDebugState,
	});
