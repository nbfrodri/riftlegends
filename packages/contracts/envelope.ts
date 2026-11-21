import { z } from "zod";
import { type CoreError, coreErrorSchema } from "./errors";

/** Bumped whenever an envelope, command, query, fact or view changes shape. */
export const CONTRACT_VERSION = 1;

/** Safe, non-negative integer: ids and positions. */
export const position = z.int().nonnegative();

type Catalog = Record<string, z.ZodType>;
type Kinds<C extends Catalog> = keyof C & string;

export type CommandOf<C extends Catalog> = {
	[K in Kinds<C>]: {
		v: typeof CONTRACT_VERSION;
		kind: K;
		sessionId: number;
		/** Position the sender expects the next fact to take (plan 04, N4). */
		expectedPosition: number;
		payload: z.infer<C[K]>;
	};
}[Kinds<C>];

export type QueryOf<C extends Catalog> = {
	[K in Kinds<C>]: {
		v: typeof CONTRACT_VERSION;
		kind: K;
		sessionId: number;
		params: z.infer<C[K]>;
	};
}[Kinds<C>];

export interface CommandCatalog<C extends Catalog> {
	readonly schema: z.ZodType<CommandOf<C>>;
}

export interface QueryCatalog<C extends Catalog> {
	readonly schema: z.ZodType<QueryOf<C>>;
}

const envelopeUnion = (
	catalog: Catalog,
	fields: (payload: z.ZodType) => z.ZodRawShape,
) => {
	const options = Object.entries(catalog).map(([kind, payload]) =>
		z.strictObject({
			v: z.literal(CONTRACT_VERSION),
			kind: z.literal(kind),
			sessionId: position,
			...fields(payload),
		}),
	);
	const [first, ...rest] = options;
	if (!first) throw new Error("A catalog needs at least one kind");
	return z.discriminatedUnion("kind", [first, ...rest]);
};

export const defineCommands = <C extends Catalog>(
	catalog: C,
): CommandCatalog<C> => ({
	schema: envelopeUnion(catalog, (payload) => ({
		expectedPosition: position,
		payload,
	})) as unknown as z.ZodType<CommandOf<C>>,
});

export const defineQueries = <C extends Catalog>(
	catalog: C,
): QueryCatalog<C> => ({
	schema: envelopeUnion(catalog, (params) => ({
		params,
	})) as unknown as z.ZodType<QueryOf<C>>,
});

type Parsed<T> = { ok: true; value: T } | { ok: false; error: CoreError };

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
	typeof raw === "object" && raw !== null && !Array.isArray(raw);

/**
 * Checks the contract version first, so a renderer and a core from different
 * builds never run each other's messages, then validates the whole envelope.
 */
const parseEnvelope = <T>(schema: z.ZodType<T>, raw: unknown): Parsed<T> => {
	if (!isRecord(raw)) {
		return {
			ok: false,
			error: { code: "invalid-command", params: { path: "" } },
		};
	}
	if (raw.v !== CONTRACT_VERSION) {
		const received = Number.isSafeInteger(raw.v)
			? (raw.v as number)
			: String(raw.v);
		return {
			ok: false,
			error: {
				code: "contract-mismatch",
				params: { expected: CONTRACT_VERSION, received },
			},
		};
	}
	const result = schema.safeParse(raw);
	if (result.success) return { ok: true, value: result.data };
	const path = result.error.issues[0]?.path.join(".") ?? "";
	return { ok: false, error: { code: "invalid-command", params: { path } } };
};

export const parseCommand = <C extends Catalog>(
	catalog: CommandCatalog<C>,
	raw: unknown,
): { ok: true; command: CommandOf<C> } | { ok: false; error: CoreError } => {
	const result = parseEnvelope(catalog.schema, raw);
	return result.ok ? { ok: true, command: result.value } : result;
};

export const parseQuery = <C extends Catalog>(
	catalog: QueryCatalog<C>,
	raw: unknown,
): { ok: true; query: QueryOf<C> } | { ok: false; error: CoreError } => {
	const result = parseEnvelope(catalog.schema, raw);
	return result.ok ? { ok: true, query: result.value } : result;
};

/** Every answer to a command: the facts it produced, or why it did nothing. */
export const responseSchema = <F extends z.ZodType>(fact: F) =>
	z.discriminatedUnion("ok", [
		z.strictObject({
			ok: z.literal(true),
			/** Position the next fact will take. */
			position,
			facts: z.array(fact),
		}),
		z.strictObject({ ok: z.literal(false), error: coreErrorSchema }),
	]);

export type Response<F> =
	| { ok: true; position: number; facts: F[] }
	| { ok: false; error: CoreError };
