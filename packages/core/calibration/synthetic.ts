import type { AiContent, Personality } from "@rift-legends/contracts";
import { DRAFT_ORDER } from "../draft/order";
import type { ProDraft } from "./bank";
import { type Resolve, rankOf } from "./metric";
import { turnAt } from "./replay";

/**
 * Drafts played by a team that follows `resolve` exactly (the best weighted
 * candidate at every step). A search that starts from other weights must be
 * able to get closer to them; used by the tests, never by the app.
 */
export function syntheticDrafts(
	content: AiContent,
	teams: readonly string[],
	resolve: Resolve,
	personalityOf: (team: string) => Personality,
	league = "TST",
): ProDraft[] {
	const drafts: ProDraft[] = [];
	for (const blue of teams) {
		for (const red of teams) {
			if (blue === red) continue;
			const id = `${league}/${blue}_${red}_1_1`;
			const actions: (string | null)[] = DRAFT_ORDER.map(() => null);
			const draft: ProDraft = {
				id,
				league,
				tournament: league,
				series: `${league}/${blue}_${red}_1`,
				game: 1,
				blue,
				red,
				winner: blue,
				actions,
				previous: [],
				wins: {},
				fearless: "off",
				winsNeeded: 1,
			};
			for (let step = 0; step < actions.length; step++) {
				const turn = turnAt(draft, step, content, personalityOf);
				if (!turn) throw new Error(`No turn at step ${step}`);
				const best = rankedBest(turn, resolve);
				actions[step] = turn.candidates[best] ?? null;
			}
			drafts.push(draft);
		}
	}
	return drafts;
}

function rankedBest(
	turn: NonNullable<ReturnType<typeof turnAt>>,
	resolve: Resolve,
) {
	for (let i = 0; i < turn.candidates.length; i++) {
		if (rankOf({ ...turn, actual: i }, resolve) === 1) return i;
	}
	throw new Error("No best candidate");
}
