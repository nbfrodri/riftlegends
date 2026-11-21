import { max } from "../../math";
import { indexContent, selectedChampions } from "../content-index";
import { type AiContext, type Component, nonzeroComponents } from "../context";
import { canAssign } from "../positions";
import { meta } from "./meta";
import { synergy } from "./synergy";
import { targetBan } from "./target-ban";
import { threatBan } from "./threat-ban";

export function scoreBan(ctx: AiContext, champion: string): Component[] {
	const index = indexContent(ctx.content);
	const candidate = index.champions.get(champion);
	if (!candidate) return [];
	const enemy = ctx.picks[ctx.rival] ?? [];
	const rivals = selectedChampions(enemy, index.champions);
	const positions = candidate.positions.filter((p) =>
		canAssign(rivals, p.role),
	);
	if (positions.length === 0) return [];
	const allies = selectedChampions(ctx.picks[ctx.team] ?? [], index.champions);
	return nonzeroComponents({
		meta: positions.reduce((best, p) => max(best, meta(p.tier)), 0),
		synergy: synergy(index.synergies.get(champion), enemy, ctx.bans),
		targetBan: targetBan(
			ctx.knowsRivalPools,
			index.rosters.get(ctx.rival),
			positions.map((p) => p.role),
			champion,
		),
		threatBan: threatBan(candidate, allies, ctx.step),
	});
}
