import type { DraftView } from "@rift-legends/contracts";
import { availability } from "./availability";
import { turn } from "./game";
import { phaseAt } from "./order";
import { availabilityInput, type SeriesState } from "./series";

const nextTurn = (state: SeriesState): DraftView["turn"] => {
	if (state.phase === "side" && state.chooser) {
		return { team: state.chooser, action: "side" };
	}
	return state.phase === "draft" && state.draft ? turn(state.draft) : null;
};

/**
 * The `draft.view` query: what the draft screen shows. `team` is who looks,
 * since with soft fearless availability depends on it.
 */
export const viewDraft = (
	state: SeriesState,
	params: { team?: string },
): DraftView | null => {
	const { config, draft } = state;
	if (!config) return null;
	const next = nextTurn(state);
	const side = (team: string, key: "blue" | "red") => ({
		team,
		bans: draft ? [...draft.bans[key]] : [],
		picks: draft ? [...draft.picks[key]] : [],
	});
	const viewer = params.team ?? next?.team ?? config.teams[0];
	return {
		game: state.game,
		wins: [state.wins[0], state.wins[1]],
		phase:
			state.phase === "draft" && draft
				? phaseAt(draft.step)
				: (state.phase as DraftView["phase"]),
		turn: next,
		blue: side(draft?.blue ?? config.teams[0], "blue"),
		red: side(draft?.red ?? config.teams[1], "red"),
		availability: availability(availabilityInput(config, state), viewer),
	};
};
