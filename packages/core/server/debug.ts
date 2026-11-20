import { createDispatcher } from "./dispatcher";

/** State of the debug catalog (see `@rift-legends/contracts` debug.ts). */
export type DebugState = { readonly count: number };

export const initialDebugState: DebugState = { count: 0 };

export const debugDispatcher = createDispatcher<DebugState>({
	commands: {
		"debug.tick": (state) => ({
			ok: true,
			state: { count: state.count + 1 },
			facts: [{ type: "debug.ticked", count: state.count + 1 }],
		}),
	},
	queries: {
		"debug.count": (state) => ({ count: state.count }),
	},
});
