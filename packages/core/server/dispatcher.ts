import {
	type CoreError,
	encodeFact,
	type Response,
} from "@rift-legends/contracts";

/** A fact as a handler emits it; the dispatcher adds its position. */
export type Emitted = { readonly type: string } & Record<string, unknown>;
export type Fact = Emitted & { readonly position: number };

export type Outcome<S> =
	| { ok: true; state: S; facts: readonly Emitted[] }
	| { ok: false; error: CoreError };

export type CommandHandler<S> = (
	state: S,
	// Payloads are validated by the contracts before they get here.
	// biome-ignore lint/suspicious/noExplicitAny: each handler declares its own payload type
	payload: any,
) => Outcome<S>;

/** What a query handler returns to answer with an error instead of a view. */
export class QueryRejection {
	constructor(readonly error: CoreError) {}
}

// biome-ignore lint/suspicious/noExplicitAny: each query declares its own params type
export type QueryHandler<S> = (state: S, params: any) => unknown;

export interface Session<S> {
	readonly id: number;
	/** Position the next fact will take. */
	readonly position: number;
	readonly state: S;
	/** The last applied command, to answer a retry without applying it twice. */
	readonly last?: {
		readonly expectedPosition: number;
		readonly key: string;
		readonly facts: readonly Fact[];
	};
}

interface Envelope {
	readonly v: number;
	readonly kind: string;
	readonly sessionId: number;
}
interface CommandEnvelope extends Envelope {
	readonly expectedPosition: number;
	readonly payload: unknown;
}
interface QueryEnvelope extends Envelope {
	readonly params: unknown;
}

export const openSession = <S>(id: number, state: S): Session<S> => ({
	id,
	position: 0,
	state,
});

const fail = (error: CoreError) => ({ ok: false as const, error });

/**
 * Runs commands and queries against a session. It is pure: it never mutates
 * the session it gets, and a rejected command returns that same session.
 */
export const createDispatcher = <S>(definition: {
	commands: Record<string, CommandHandler<S>>;
	queries: Record<string, QueryHandler<S>>;
}) => {
	const handle = (
		session: Session<S>,
		command: CommandEnvelope,
	): { session: Session<S>; response: Response<Fact> } => {
		const reject = (error: CoreError) => ({ session, response: fail(error) });

		if (command.sessionId !== session.id) {
			return reject({
				code: "unknown-session",
				params: { sessionId: command.sessionId },
			});
		}
		const key = encodeFact({ kind: command.kind, payload: command.payload });
		const { last } = session;
		if (last && command.expectedPosition === last.expectedPosition) {
			// A retry after a lost response: answer it, do not apply it again.
			return last.key === key
				? {
						session,
						response: {
							ok: true,
							position: session.position,
							facts: [...last.facts],
						},
					}
				: reject({
						code: "stale-position",
						params: { expected: session.position },
					});
		}
		if (command.expectedPosition !== session.position) {
			return reject({
				code: "stale-position",
				params: { expected: session.position },
			});
		}

		const handler = definition.commands[command.kind];
		if (!handler) throw new Error(`No handler for command ${command.kind}`);
		const outcome = handler(session.state, command.payload);
		if (!outcome.ok) return reject(outcome.error);
		if (outcome.facts.length === 0) {
			throw new Error(`Command ${command.kind} was accepted without facts`);
		}

		const facts = outcome.facts.map((fact, index) => ({
			...fact,
			position: session.position + index,
		}));
		const position = session.position + facts.length;
		return {
			session: {
				id: session.id,
				position,
				state: outcome.state,
				last: { expectedPosition: command.expectedPosition, key, facts },
			},
			response: { ok: true, position, facts },
		};
	};

	const query = (
		session: Session<S>,
		request: QueryEnvelope,
	): { ok: true; view: unknown } | { ok: false; error: CoreError } => {
		if (request.sessionId !== session.id) {
			return fail({
				code: "unknown-session",
				params: { sessionId: request.sessionId },
			});
		}
		const handler = definition.queries[request.kind];
		if (!handler) throw new Error(`No handler for query ${request.kind}`);
		const view = handler(session.state, request.params);
		return view instanceof QueryRejection
			? fail(view.error)
			: { ok: true, view };
	};

	return { handle, query };
};
