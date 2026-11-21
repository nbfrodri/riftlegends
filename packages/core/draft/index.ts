import { createDispatcher } from "../server/dispatcher";
import { initialSeries, type SeriesState, seriesCommands } from "./series";
import { viewDraft } from "./view";

export type { SeriesState } from "./series";

/** Dispatcher of the draft catalog (plan 06). */
export const draftDispatcher = createDispatcher<SeriesState>({
	commands: seriesCommands,
	queries: { "draft.view": viewDraft },
});

export const initialDraftState = initialSeries;
