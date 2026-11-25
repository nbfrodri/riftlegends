import {
	type CommandCatalog,
	type CoreError,
	competitionCommands,
	competitionQueries,
	debugCommands,
	debugQueries,
	draftCommands,
	draftQueries,
	parseCommand,
	parseQuery,
	type QueryCatalog,
	type Response,
} from "@rift-legends/contracts";
import {
	CONTENT_VERSION,
	type createDispatcher,
	debugDispatcher,
	draftDispatcher,
	draftStateWith,
	type Fact,
	initialDebugState,
	loadRealContent,
	openSession,
	packagedDraftContent,
	packagedMatchContent,
	type Session,
	seasonDispatcher,
	seasonStateWith,
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

/** A catalog with its dispatcher and the state a new session starts from. */
interface HostModule<S> {
	/**
	 * Whether a command or query `kind` belongs to this module; `params` is
	 * the raw query params, for kinds that two modules share.
	 */
	owns(kind: string, params?: unknown): boolean;
	commands: CommandCatalog<AnyCatalog>;
	queries: QueryCatalog<AnyCatalog>;
	dispatcher: ReturnType<typeof createDispatcher<S>>;
	initialState: () => S;
}

// biome-ignore lint/suspicious/noExplicitAny: modules differ in their state; each one only sees its own
type AnyModule = HostModule<any>;

/**
 * The core's side of the IPC: validates every message, owns the sessions and
 * runs the dispatchers. Messages are handled one at a time, in arrival order.
 * A session holds one state per module; a message goes to the module that
 * owns its `kind`, and the first module takes whatever nobody owns.
 */
const createHost = (modules: readonly [AnyModule, ...AnyModule[]]) => {
	const sessions = new Map<number, Session<unknown>[]>();
	let nextSessionId = 1;

	const unknownSession = (sessionId: number): HostResult => ({
		ok: false,
		error: { code: "unknown-session", params: { sessionId } },
	});

	const moduleOf = (raw: unknown) => {
		const kind = isRecord(raw) && typeof raw.kind === "string" ? raw.kind : "";
		const params = isRecord(raw) ? raw.params : undefined;
		const index = modules.findIndex((m) => m.owns(kind, params));
		return index === -1 ? 0 : index;
	};

	const run = (message: Record<string, unknown>): HostResult => {
		if (message.op === "open") {
			const sessionId = nextSessionId++;
			sessions.set(
				sessionId,
				modules.map((m) => openSession(sessionId, m.initialState())),
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
		const index = moduleOf(raw);
		const module = modules[index] as AnyModule;

		if (message.op === "query") {
			const parsed = parseQuery(module.queries, raw);
			if (!parsed.ok) return parsed;
			const session = sessions.get(parsed.query.sessionId)?.[index];
			if (!session) return unknownSession(parsed.query.sessionId);
			return module.dispatcher.query(session, parsed.query);
		}

		const parsed = parseCommand(module.commands, raw);
		if (!parsed.ok) return parsed;
		const all = sessions.get(parsed.command.sessionId);
		const session = all?.[index];
		if (!all || !session) return unknownSession(parsed.command.sessionId);
		const { session: next, response } = module.dispatcher.handle(
			session,
			parsed.command,
		);
		all[index] = next;
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

/**
 * The game's host: the draft catalog with the packaged content loaded in each
 * session (plan 09) and the real content a series can name (plan 11), plus the debug catalog that the renderer probe and the
 * IPC E2E use (plan 04).
 */
export const createCoreHost = () =>
	createHost([
		{
			// `series.summary` and `match.view` of a season series name it with `series`.
			owns: (kind, params) =>
				/^(season|competition|team)\./.test(kind) ||
				((kind === "series.summary" || kind === "match.view") &&
					isRecord(params) &&
					"series" in params),
			commands: competitionCommands,
			queries: competitionQueries,
			dispatcher: seasonDispatcher,
			initialState: () =>
				seasonStateWith(function* () {
					yield {
						content: packagedDraftContent,
						match: packagedMatchContent,
						version: CONTENT_VERSION,
					};
					const { draft: content, match, version } = loadRealContent();
					yield { content, match, version };
				}),
		},
		{
			owns: (kind) => !kind.startsWith("debug."),
			commands: draftCommands,
			queries: draftQueries,
			dispatcher: draftDispatcher,
			initialState: () =>
				draftStateWith(packagedDraftContent, packagedMatchContent, {
					real: () => {
						const { draft, match, season } = loadRealContent();
						return { content: draft, match, season };
					},
				}),
		},
		{
			owns: (kind) => kind.startsWith("debug."),
			commands: debugCommands,
			queries: debugQueries,
			dispatcher: debugDispatcher,
			initialState: () => initialDebugState,
		},
	]);
