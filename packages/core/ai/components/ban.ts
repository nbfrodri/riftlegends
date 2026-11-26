import type { Role } from "@rift-legends/contracts";
import { max } from "../../math";
import { indexContent, selectedChampions } from "../content-index";
import { type AiContext, type Component, nonzeroComponents } from "../context";
import { canAssign } from "../positions";
import { meta } from "./meta";
import { synergy } from "./synergy";
import { targetBan } from "./target-ban";
import { threatBan } from "./threat-ban";

/** Scores the bans of one decision: what does not depend on the champion is worked out once. */
export function banScorer(ctx: AiContext) {
	const index = indexContent(ctx.content);
	const enemy = ctx.picks[ctx.rival] ?? [];
	const rivals = selectedChampions(enemy, index.champions);
	const allies = selectedChampions(ctx.picks[ctx.team] ?? [], index.champions);
	const roster = index.rosters.get(ctx.rival);
	const open = new Map<Role, boolean>();
	const canTake = (role: Role) => {
		let ok = open.get(role);
		if (ok === undefined) {
			ok = canAssign(rivals, role);
			open.set(role, ok);
		}
		return ok;
	};
	return (champion: string): Component[] => {
		const candidate = index.champions.get(champion);
		if (!candidate) return [];
		const positions = candidate.positions.filter((p) => canTake(p.role));
		if (positions.length === 0) return [];
		return nonzeroComponents({
			meta: positions.reduce((best, p) => max(best, meta(p.tier)), 0),
			synergy: synergy(index.synergies.get(champion), enemy, ctx.bans),
			targetBan: targetBan(
				ctx.knowsRivalPools,
				roster,
				positions.map((p) => p.role),
				champion,
			),
			threatBan: threatBan(candidate, allies, ctx.step),
		});
	};
}

export const scoreBan = (ctx: AiContext, champion: string): Component[] =>
	banScorer(ctx)(champion);
