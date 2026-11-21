import type { AiContent } from "@rift-legends/contracts";
import { createDispatcher } from "../server/dispatcher";
import { aiTurn } from "./ai-turn";
import { initialSeries, type SeriesState, seriesCommands } from "./series";
import { viewDraft } from "./view";

export type { SeriesState } from "./series";

/** Dispatcher of the draft catalog (plan 06). */
export const draftDispatcher = createDispatcher<SeriesState>({
	commands: { ...seriesCommands, "draft.ai": aiTurn },
	queries: { "draft.view": viewDraft },
});

export const initialDraftState = initialSeries;

/** A draft session whose AI teams read `content` (plan 07). */
export const draftStateWith = (content: AiContent): SeriesState => ({
	...initialSeries,
	content,
});
