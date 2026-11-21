import { z } from "zod";

/**
 * Stable error codes the core can answer with. The UI translates each one with
 * the `errors.<code>` key; the core never sends user-facing text.
 */
export const ERROR_CODES = [
	"contract-mismatch",
	"invalid-command",
	"unknown-session",
	"stale-position",
	"core-restarted",
	"core-timeout",
	// Draft rules (plan 06)
	"not-your-turn",
	"wrong-action",
	"champion-unavailable",
	"invalid-roles",
	"pool-too-small",
	"series-over",
	"timer-off",
	"game-not-played",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorKey = (code: ErrorCode) => `errors.${code}` as const;

/** Params interpolated into the translated message. */
const errorParamsSchema = z.record(z.string(), z.union([z.string(), z.int()]));

export const coreErrorSchema = z.strictObject({
	code: z.enum(ERROR_CODES),
	params: errorParamsSchema,
});

export type CoreError = z.infer<typeof coreErrorSchema>;
