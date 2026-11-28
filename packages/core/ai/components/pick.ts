import { ROLES, type Role } from "@rift-legends/contracts";
import {
	type Champion,
	indexContent,
	selectedChampions,
} from "../content-index";
import { type AiContext, type Component, nonzeroComponents } from "../context";
import { lanesOf } from "../lanes";
import { canAssign } from "../positions";
import { compositionFor } from "./composition";
import { fearlessReserve } from "./fearless-reserve";
import { flex } from "./flex";
import { identityFor } from "./identity";
import { rivalsInRole, worstMatchup } from "./matchup";
import {
	counterPoints,
	keepableLanes,
	keepCost,
	orderPlan,
	securePoints,
} from "./side";
import { synergy } from "./synergy";

/**
 * Scores the candidates of one decision. What does not depend on the
 * candidate (picks, rosters, lane assignment, unavailable champions) is
 * worked out once, so scoring every free champion stays cheap.
 */
export function pickScorer(ctx: AiContext) {
	const index = indexContent(ctx.content);
	const own = ctx.picks[ctx.team] ?? [];
	const enemy = ctx.picks[ctx.rival] ?? [];
	const allies = selectedChampions(own, index.champions);
	const rivals = selectedChampions(enemy, index.champions);
	const roster = index.rosters.get(ctx.team);
	const unavailable = new Set([
		...own,
		...enemy,
		...ctx.bans.filter((b) => b !== null),
	]);
	const liveOwn = own.filter((id) => !ctx.bans.includes(id));
	const composition = compositionFor(allies);
	const identity = identityFor(ctx.content.identities, allies);
	const assignable = new Map<Role, boolean>();
	const canTake = (role: Role) => {
		let ok = assignable.get(role);
		if (ok === undefined) {
			ok = canAssign(allies, role);
			assignable.set(role, ok);
		}
		return ok;
	};
	const sharing = new Map<Role, readonly Champion[]>();
	const rivalsIn = (role: Role) => {
		let list = sharing.get(role);
		if (!list) {
			list = rivalsInRole(rivals, role);
			sharing.set(role, list);
		}
		return list;
	};
	const scores = {
		meta: 0,
		comfort: 0,
		matchup: 0,
		synergy: 0,
		composition: 0,
		flex: 0,
		identity: 0,
		fearlessReserve: 0,
		firstPick: 0,
		lastPick: 0,
	};
	const trusted = roster?.size === ROLES.length;
	const plan = orderPlan(ctx);
	const keep =
		plan === "keep" ? keepCost(keepableLanes(allies), rivals) : undefined;
	/** Fills a shared record: read it before scoring the next champion. */
	return (champion: string): typeof scores | undefined => {
		const candidate = index.champions.get(champion);
		if (!candidate) return undefined;
		// Use one lane's breakdown. Combining the best tier in one lane with
		// a main or a counter in another would explain an impossible pick.
		let best = Number.MIN_SAFE_INTEGER;
		let playable = 0;
		let laneKeep = 0;
		scores.meta = scores.comfort = scores.matchup = 0;
		for (const lane of lanesOf(index, ctx.team, champion)) {
			const { role } = lane;
			if (!canTake(role)) continue;
			playable++;
			const laneMeta = lane.meta;
			const laneComfort = lane.comfort;
			const laneMatchup = worstMatchup(lane.row, rivalsIn(role));
			const keepPoints = keep?.(role) ?? 0;
			const total = laneMeta + laneComfort + laneMatchup + keepPoints;
			if (total > best) {
				scores.meta = laneMeta;
				scores.comfort = laneComfort;
				scores.matchup = laneMatchup;
				laneKeep = keepPoints;
				best = total;
			}
		}
		scores.flex =
			trusted && playable > 1
				? flex(
						candidate,
						candidate.positions.flatMap((p) => (canTake(p.role) ? p.role : [])),
						allies,
						roster,
						unavailable,
					)
				: 0;
		scores.synergy = synergy(index.synergies.get(champion), liveOwn, []);
		scores.composition = composition(candidate);
		scores.identity = identity(candidate);
		scores.fearlessReserve = fearlessReserve(ctx, candidate);
		scores.firstPick =
			plan === "secure" ? securePoints(scores.flex, scores.meta) : 0;
		scores.lastPick =
			plan === "counter"
				? counterPoints(scores.matchup)
				: plan === "keep"
					? laneKeep
					: 0;
		return scores;
	};
}

/** `scorePick` for many champions of the same decision. */
export function pickComponents(ctx: AiContext) {
	const score = pickScorer(ctx);
	return (champion: string): Component[] => {
		const scores = score(champion);
		return scores ? nonzeroComponents(scores) : [];
	};
}

export function scorePick(ctx: AiContext, champion: string): Component[] {
	return pickComponents(ctx)(champion);
}

/** Sum of the points `scorePick` would give; 0 for an unknown champion. */
export function pickTotal(
	score: ReturnType<typeof pickScorer>,
	champion: string,
) {
	let total = 0;
	const scores: Readonly<Record<string, number>> | undefined = score(champion);
	if (!scores) return 0;
	for (const key in scores) total += scores[key] as number;
	return total;
}
