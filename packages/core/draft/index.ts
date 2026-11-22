import type { AiContent, MatchContent } from "@rift-legends/contracts";
import { createDispatcher } from "../server/dispatcher";
import { aiTurn } from "./ai-turn";
import { viewPlan } from "./match-plan";
import { viewMatch } from "./match-view";
import { viewOptions } from "./options";
import {
	type ContentLibrary,
	initialSeries,
	type SeriesState,
	seriesCommands,
} from "./series";
import { viewSummary } from "./summary";
import { viewDraft } from "./view";

export type { ContentLibrary, SeriesState } from "./series";

/** Dispatcher of the draft catalog (plan 06). */
export const draftDispatcher = createDispatcher<SeriesState>({
	commands: { ...seriesCommands, "draft.ai": aiTurn },
	queries: {
		"draft.view": viewDraft,
		"match.plan": viewPlan,
		"match.view": viewMatch,
		"series.summary": viewSummary,
		"series.options": viewOptions,
	},
});

/**
 * A session whose AI teams read `content` (plan 07) and whose games are played
 * with `match` (plan 08). `library` adds the other sets a series can name; the
 * given content is the `fictional` one.
 */
export const draftStateWith = (
	content: AiContent,
	match: MatchContent | null = null,
	library: ContentLibrary = {},
): SeriesState => ({
	...initialSeries,
	content,
	match,
	library: match
		? { fictional: () => ({ content, match }), ...library }
		: library,
});
