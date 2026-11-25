import type { AiContent, Personality } from "@rift-legends/contracts";
import { scoreBan } from "../ai/components/ban";
import { scorePick } from "../ai/components/pick";
import type { AiContext } from "../ai/context";
import { availability } from "../draft/availability";
import { DRAFT_ORDER, phaseAt } from "../draft/order";
import type { ProDraft } from "./bank";

/** Every component the pick and ban scorers can emit, in matrix column order. */
export const COMPONENT_KEYS = [
	"meta",
	"comfort",
	"matchup",
	"synergy",
	"composition",
	"flex",
	"identity",
	"fearlessReserve",
	"side",
	"targetBan",
	"threatBan",
] as const;

export type Phase = Exclude<ReturnType<typeof phaseAt>, "roles">;
export const PHASES: readonly Phase[] = ["bans1", "picks1", "bans2", "picks2"];

/** One real decision, with the AI's component scores for every free champion. */
export interface Turn {
	readonly league: string;
	readonly phase: Phase;
	readonly action: "ban" | "pick";
	readonly personality: Personality;
	readonly candidates: readonly string[];
	/** Row-major `candidates × COMPONENT_KEYS` fixed-point scores. */
	readonly points: Int32Array;
	/** Index in `candidates` of the champion the pro team took. */
	readonly actual: number;
}

const K = COMPONENT_KEYS.length;

/** The turn at `step` as the AI sees it: the draft before that action. */
export function turnAt(
	draft: ProDraft,
	step: number,
	content: AiContent,
	personalityOf: (team: string) => Personality,
): Omit<Turn, "actual"> | null {
	const { action, order } = DRAFT_ORDER[step] ?? {};
	if (!action || !order) return null;
	const team = order === "first" ? draft.blue : draft.red;
	const rival = team === draft.blue ? draft.red : draft.blue;
	const picks: Record<string, string[]> = { [draft.blue]: [], [draft.red]: [] };
	const bans = {
		[draft.blue]: [] as (string | null)[],
		[draft.red]: [] as (string | null)[],
	};
	for (let i = 0; i < step; i++) {
		const turn = DRAFT_ORDER[i];
		const owner = turn?.order === "first" ? draft.blue : draft.red;
		const champion = draft.actions[i] ?? null;
		if (turn?.action === "pick") picks[owner]?.push(champion as string);
		else bans[owner]?.push(champion);
	}
	const allBans = [...(bans[draft.blue] ?? []), ...(bans[draft.red] ?? [])];
	const ctx: AiContext = {
		content,
		team,
		rival,
		order,
		step,
		picks,
		bans: allBans,
		fearless: draft.fearless,
		game: draft.game,
		wins: [draft.wins[team] ?? 0, draft.wins[rival] ?? 0],
		winsNeeded: draft.winsNeeded,
		knowsRivalPools: true,
	};
	const candidates = availability(
		{
			pool: content.champions.map((c) => c.id),
			fearless: draft.fearless,
			previous: draft.previous,
			bans: allBans,
			picks,
		},
		team,
	)
		.filter((entry) => entry.status === "free")
		.map((entry) => entry.champion);
	const score = action === "ban" ? scoreBan : scorePick;
	const points = new Int32Array(candidates.length * K);
	candidates.forEach((champion, row) => {
		for (const component of score(ctx, champion)) {
			const column = COMPONENT_KEYS.indexOf(component.key as never);
			if (column < 0) throw new Error(`Unknown component ${component.key}`);
			points[row * K + column] = component.points;
		}
	});
	return {
		league: draft.league,
		phase: phaseAt(step) as Phase,
		action,
		personality: personalityOf(team),
		candidates,
		points,
	};
}

/**
 * The turns of a pro draft. Empty bans and champions the AI would not be
 * allowed to take (a fearless guess gone wrong) are counted as skipped.
 */
export function replay(
	draft: ProDraft,
	content: AiContent,
	personalityOf: (team: string) => Personality,
): { turns: Turn[]; skipped: number } {
	const turns: Turn[] = [];
	let skipped = 0;
	for (let step = 0; step < DRAFT_ORDER.length; step++) {
		const real = draft.actions[step];
		const turn = real ? turnAt(draft, step, content, personalityOf) : null;
		const actual = turn && real ? turn.candidates.indexOf(real) : -1;
		if (!turn || actual < 0) skipped++;
		else turns.push({ ...turn, actual });
	}
	return { turns, skipped };
}
