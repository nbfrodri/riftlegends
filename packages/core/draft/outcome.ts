import type { CoreError } from "@rift-legends/contracts";
import type { Emitted, Outcome } from "../server/dispatcher";
import type { Format } from "./availability";
import type { SeriesConfig, SeriesState } from "./series";

export const WINS_NEEDED: Record<Format, number> = { bo1: 1, bo3: 2, bo5: 3 };

export const fail = (
	code: CoreError["code"],
	params: CoreError["params"] = {},
): Outcome<SeriesState> => ({ ok: false, error: { code, params } });

export const done = (
	state: SeriesState,
	...facts: Emitted[]
): Outcome<SeriesState> => ({ ok: true, state, facts });

export const other = (config: SeriesConfig, team: string) =>
	config.teams[0] === team ? config.teams[1] : config.teams[0];
