import { z } from "zod";
import { defineCommands, defineQueries } from "./envelope";

/**
 * A minimal catalog to exercise the IPC plumbing until the draft rules
 * (plan 06) bring the real commands. It is not part of the game.
 */
export const debugCommands = defineCommands({
	"debug.tick": z.strictObject({}),
});

export const debugQueries = defineQueries({
	"debug.count": z.strictObject({}),
});
