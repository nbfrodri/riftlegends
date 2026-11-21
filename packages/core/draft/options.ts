import type { SeriesOptions } from "@rift-legends/contracts";
import type { SeriesState } from "./series";

/**
 * The `series.options` query: the teams and the champion pool (with the roles each one plays) the session was
 * opened with, for the setup screen. Empty in a session without content.
 */
export const viewOptions = (state: SeriesState): SeriesOptions => ({
	teams: (state.match?.teams ?? []).map(({ id, name, coach }) => ({
		id,
		name: name ?? id,
		...(coach ? { coach } : {}),
	})),
	pool: (state.content?.champions ?? []).map((champion) => champion.id),
	positions: Object.fromEntries(
		(state.content?.champions ?? []).map((champion) => [
			champion.id,
			champion.positions,
		]),
	),
});
