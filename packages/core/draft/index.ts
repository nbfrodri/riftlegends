import type { AiContent, MatchContent } from "@rift-legends/contracts";
import { createDispatcher } from "../server/dispatcher";
import { aiTurn } from "./ai-turn";
import { viewMatch } from "./match-view";
import { initialSeries, type SeriesState, seriesCommands } from "./series";
import { viewDraft } from "./view";

export type { SeriesState } from "./series";

/** Dispatcher of the draft catalog (plan 06). */
export const draftDispatcher = createDispatcher<SeriesState>({
	commands: { ...seriesCommands, "draft.ai": aiTurn },
	queries: { "draft.view": viewDraft, "match.view": viewMatch },
});

/**
 * A session whose AI teams read `content` (plan 07) and whose games are played
 * with `match` (plan 08).
 */
export const draftStateWith = (
	content: AiContent,
	match: MatchContent | null = null,
): SeriesState => ({
	...initialSeries,
	content,
	match,
});
