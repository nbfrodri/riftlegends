import type { SideChoice } from "@rift-legends/contracts";
import { type SeriesState, seriesCommands } from "../draft/series";
import type { CommandHandler } from "../server/dispatcher";

const choose = seriesCommands["side.choose"] as CommandHandler<SeriesState>;

/**
 * The two `side.choose` payloads that put `blue` on blue with first pick, as
 * before the split choice (issue #305): the team with priority takes its map
 * side and the rival its order.
 */
export const sideChoices = (
	state: SeriesState,
	blue: string,
): { team: string; choice: SideChoice }[] => {
	const priority = state.chooser as string;
	const rival = state.config?.teams.find((t) => t !== priority) as string;
	return [
		{ team: priority, choice: priority === blue ? "blue" : "red" },
		{ team: rival, choice: rival === blue ? "first" : "last" },
	];
};

/** Makes both side choices on the state; see `sideChoices`. */
export const takeSides = (state: SeriesState, blue: string): SeriesState =>
	sideChoices(state, blue).reduce((current, payload) => {
		const outcome = choose(current, payload);
		if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
		return outcome.state;
	}, state);
