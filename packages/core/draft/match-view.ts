import type { MatchView } from "@rift-legends/contracts";
import { QueryRejection } from "../server/dispatcher";
import type { SeriesState } from "./series";

/**
 * The `match.view` query: the facts a played game emitted and the map minute
 * by minute, so the screen can replay it without simulating again (plan 09,
 * Q3 and Q4).
 */
export const viewMatch = (
	state: SeriesState,
	params: { game: number },
): MatchView | QueryRejection => {
	const facts = state.matches[params.game - 1];
	if (!facts) {
		return new QueryRejection({
			code: "game-not-played",
			params: { game: params.game },
		});
	}
	const snapshots = state.maps[params.game - 1] ?? [];
	return { game: params.game, facts, snapshots } as MatchView;
};
