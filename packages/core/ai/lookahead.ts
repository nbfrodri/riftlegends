import { DRAFT_ORDER, type Order } from "../draft/order";
import { min, SCALE } from "../math";
import type { Scored } from "./choose";
import { pickScorer, pickTotal } from "./components/pick";
import { indexContent, selectedChampions } from "./content-index";
import type { AiContext } from "./context";
import { canAssign } from "./positions";
import { replyScorer } from "./reply-scorer";

export interface Reply {
	readonly champion: string;
	/** The rival pick's contribution, before our possible answer. */
	readonly points: number;
}

type Free = (team: string, picks: AiContext["picks"]) => readonly string[];

function nextPick(after: number, order: Order) {
	return DRAFT_ORDER.findIndex(
		(turn, step) =>
			step > after && turn.action === "pick" && turn.order === order,
	);
}

function withPick(ctx: AiContext, champion: string): AiContext["picks"] {
	return {
		...ctx.picks,
		[ctx.team]: [...(ctx.picks[ctx.team] ?? []), champion],
	};
}

function bestPick(ctx: AiContext, free: Free) {
	let best: string | undefined;
	let bestTotal = Number.MIN_SAFE_INTEGER;
	const score = pickScorer(ctx);
	for (const id of free(ctx.team, ctx.picks)) {
		const total = pickTotal(score, id);
		if (
			total > bestTotal ||
			(total === bestTotal && (best === undefined || id < best))
		) {
			best = id;
			bestTotal = total;
		}
	}
	return best;
}

/** Worst shared lane still possible with the board as it stood before this pair. */
function pairMatchup(
	ctx: AiContext,
	picks: AiContext["picks"],
	own: string,
	enemy: string,
) {
	const { champions, matchups } = indexContent(ctx.content);
	const candidate = champions.get(own);
	const opponent = champions.get(enemy);
	if (!candidate || !opponent) return 0;
	const allies = selectedChampions(picks[ctx.team] ?? [], champions);
	const rivals = selectedChampions(picks[ctx.rival] ?? [], champions);
	let worst: number | undefined;
	for (const { role } of candidate.positions) {
		if (
			!opponent.positions.some((p) => p.role === role) ||
			!canAssign(allies, role) ||
			!canAssign(rivals, role)
		)
			continue;
		// Content can describe a counter from either champion's perspective.
		const value =
			matchups.get(own)?.get(role)?.get(enemy) ??
			-(matchups.get(enemy)?.get(role)?.get(own) ?? 0);
		worst = worst === undefined ? value : min(worst, value);
	}
	return (worst ?? 0) * SCALE;
}

function answerAdjustment(matchup: number) {
	if (matchup < -2 * SCALE) return -2 * SCALE;
	return matchup > 2 * SCALE ? 15_000 : 0;
}

/** Evaluate the supplied shortlist without drawing from the decision RNG. */
export function lookahead(
	ctx: AiContext,
	candidates: readonly Scored[],
	depth: 0 | 1 | 2,
	free: Free,
): { candidates: Scored[]; replies: ReadonlyMap<string, Reply> } {
	const replies = new Map<string, Reply>();
	if (depth === 0 || DRAFT_ORDER[ctx.step]?.action !== "pick")
		return { candidates: [...candidates], replies };

	const rivalOrder = ctx.order === "first" ? "last" : "first";
	const replyStep = nextPick(ctx.step, rivalOrder);
	if (replyStep < 0) return { candidates: [...candidates], replies };
	const answerStep = depth === 2 ? nextPick(replyStep, ctx.order) : -1;

	const rivalBase: AiContext = {
		...ctx,
		order: rivalOrder,
		team: ctx.rival,
		rival: ctx.team,
		wins: [ctx.wins[1], ctx.wins[0]],
		step: replyStep,
	};
	// The rival's search is shared while only our candidate leaves its open champions.
	let shared: {
		readonly open: ReadonlySet<string>;
		readonly best: (last: string) => string | undefined;
	} | null = null;
	const adjusted = candidates.map((candidate) => {
		const rivalTurn: AiContext = {
			...rivalBase,
			picks: withPick(ctx, candidate.champion),
		};
		const left = free(ctx.rival, rivalTurn.picks);
		if (!shared) {
			const open = new Set([...left, candidate.champion]);
			shared = { open, best: replyScorer(rivalBase, [...open]) };
		}
		const { open, best } = shared;
		const same =
			left.length === open.size - (open.has(candidate.champion) ? 1 : 0) &&
			left.every((id) => open.has(id) && id !== candidate.champion);
		const reply = same ? best(candidate.champion) : bestPick(rivalTurn, free);
		if (reply === undefined) return candidate;
		const matchup = pairMatchup(ctx, ctx.picks, candidate.champion, reply);
		let points = matchup < -2 * SCALE ? matchup / 2 : 0;
		replies.set(candidate.champion, { champion: reply, points });

		if (answerStep >= 0) {
			const withReply = withPick(rivalTurn, reply);
			const answer = replyScorer(
				{ ...ctx, step: answerStep, picks: rivalTurn.picks },
				free(ctx.team, withReply),
			)(reply);
			if (answer !== undefined)
				points += answerAdjustment(
					pairMatchup(ctx, rivalTurn.picks, answer, reply),
				);
		}
		return points === 0
			? candidate
			: {
					...candidate,
					components: [...candidate.components, { key: "lookahead", points }],
				};
	});
	return { candidates: adjusted, replies };
}
