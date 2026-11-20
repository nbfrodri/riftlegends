import { z } from "zod";
import { defineCommands, defineQueries, position } from "./envelope";
import { defineFacts } from "./facts";

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

export const debugFacts = defineFacts({
	"debug.ticked": { count: position },
});
