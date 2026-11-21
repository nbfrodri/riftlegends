import { indexContent, selectedChampions } from "../content-index";
import { type AiContext, type Component, nonzeroComponents } from "../context";
import { canAssign } from "../positions";
import { comfort } from "./comfort";
import { composition } from "./composition";
import { fearlessReserve } from "./fearless-reserve";
import { flex } from "./flex";
import { identity } from "./identity";
import { matchup } from "./matchup";
import { meta } from "./meta";
import { side } from "./side";
import { synergy } from "./synergy";

export function scorePick(ctx: AiContext, champion: string): Component[] {
	const index = indexContent(ctx.content);
	const candidate = index.champions.get(champion);
	if (!candidate) return [];
	const own = ctx.picks[ctx.team] ?? [];
	const enemy = ctx.picks[ctx.rival] ?? [];
	const allies = selectedChampions(own, index.champions);
	const rivals = selectedChampions(enemy, index.champions);
	const roster = index.rosters.get(ctx.team);
	const positions = candidate.positions.filter((p) =>
		canAssign(allies, p.role),
	);
	// Use one lane's breakdown. Combining the best tier in one lane with
	// a main or a counter in another would explain an impossible pick.
	let lane = { meta: 0, comfort: 0, matchup: 0 };
	let best = Number.MIN_SAFE_INTEGER;
	for (const { role, tier } of positions) {
		const scores = {
			meta: meta(tier),
			comfort: comfort(roster?.get(role), champion),
			matchup: matchup(index.matchups.get(champion)?.get(role), role, rivals),
		};
		const total = scores.meta + scores.comfort + scores.matchup;
		if (total > best) {
			lane = scores;
			best = total;
		}
	}
	const unavailable = new Set([
		...own,
		...enemy,
		...ctx.bans.filter((b) => b !== null),
	]);
	const flexPoints = flex(
		candidate,
		positions.map((p) => p.role),
		allies,
		roster,
		unavailable,
	);
	return nonzeroComponents({
		...lane,
		synergy: synergy(index.synergies.get(champion), own, ctx.bans),
		composition: composition(candidate, allies),
		flex: flexPoints,
		identity: identity(ctx.content.identities, candidate, allies),
		fearlessReserve: fearlessReserve(ctx, candidate),
		side: side(ctx, flexPoints, lane.matchup),
	});
}
