import { z } from "zod";
import { position } from "./envelope";

type Shapes = Record<string, z.ZodRawShape>;

export type FactOf<C extends Shapes> = {
	[T in keyof C & string]: { type: T; position: number } & z.infer<
		z.ZodObject<C[T]>
	>;
}[keyof C & string];

export interface FactCatalog<C extends Shapes> {
	readonly schema: z.ZodType<FactOf<C>>;
}

/** Each fact type adds its own fields to `type` and `position`. */
export const defineFacts = <C extends Shapes>(catalog: C): FactCatalog<C> => {
	const options = Object.entries(catalog).map(([type, shape]) =>
		z.strictObject({ type: z.literal(type), position, ...shape }),
	);
	const [first, ...rest] = options;
	if (!first) throw new Error("A fact catalog needs at least one type");
	return {
		schema: z.discriminatedUnion("type", [
			first,
			...rest,
		]) as unknown as z.ZodType<FactOf<C>>,
	};
};

const canonical = (value: unknown): string => {
	if (typeof value === "string" || typeof value === "boolean") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isSafeInteger(value)) {
			throw new Error(`Facts only hold safe integers, got ${value}`);
		}
		return String(value);
	}
	if (value === null) return "null";
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (typeof value === "object") {
		const entries = Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
			);
		return `{${entries.join(",")}}`;
	}
	throw new Error(`Facts cannot hold a ${typeof value}`);
};

/**
 * One line of JSON with keys sorted and no spaces: the same fact always gives
 * the same bytes, on any platform and whatever order its keys were set in.
 */
export const encodeFact = (fact: object): string => canonical(fact);

/** Parses a line and accepts it only if it is a valid fact in canonical form. */
export const decodeFact = <C extends Shapes>(
	catalog: FactCatalog<C>,
	line: string,
): FactOf<C> => {
	const fact = catalog.schema.parse(JSON.parse(line));
	if (encodeFact(fact) !== line) {
		throw new Error(`Fact is not in canonical form: ${line}`);
	}
	return fact;
};

/** A log is one canonical fact per line, each ending in LF. */
export const encodeLog = (facts: readonly object[]): string =>
	facts.map((fact) => `${encodeFact(fact)}\n`).join("");

export const decodeLog = <C extends Shapes>(
	catalog: FactCatalog<C>,
	log: string,
): FactOf<C>[] => {
	if (log === "") return [];
	if (!log.endsWith("\n")) throw new Error("A fact log must end in LF");
	return log
		.slice(0, -1)
		.split("\n")
		.map((line) => decodeFact(catalog, line));
};
