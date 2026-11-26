import { ROLES, type Role } from "@rift-legends/contracts";
import { DRAFT_ORDER, phaseAt } from "../draft/order";
import { SCALE } from "../math";
import { compositionFor } from "./components/composition";
import { fearlessReserve } from "./components/fearless-reserve";
import { flex } from "./components/flex";
import { identityFor } from "./components/identity";
import { rivalsInRole, worstMatchup } from "./components/matchup";
import { synergy } from "./components/synergy";
import {
	type Champion,
	indexContent,
	selectedChampions,
} from "./content-index";
import type { AiContext } from "./context";
import { type Lane, lanesOf } from "./lanes";
import { canAssign } from "./positions";

/** What a free champion scores whatever the opponent picked last. */
interface Fixed {
	readonly champion: string;
	readonly candidate: Champion | undefined;
	readonly lanes: readonly Lane[];
	readonly synergy: number;
	readonly composition: number;
	readonly identity: number;
	readonly fearless: number;
	/** Roles worth a flex check, when the roster is trusted. */
	readonly flexRoles: readonly Role[] | undefined;
	readonly flexBound: number;
	/** No total above this: lets the search stop early. */
	readonly bound: number;
	baseFlex?: number;
}

const tops = new WeakMap<ReadonlyMap<string, number>, number>();
/** The best value of a matchup row in points, and 0 at least: no worst matchup is above it. */
function topOf(row: ReadonlyMap<string, number>) {
	let top = tops.get(row);
	if (top === undefined) {
		top = 0;
		for (const value of row.values())
			if (value * SCALE > top) top = value * SCALE;
		tops.set(row, top);
	}
	return top;
}

/**
 * The best reply of the team in `base` once the rival has also picked `last`.
 * The same total as `pickTotal(pickScorer(...))` for every free champion and
 * the same tie rule, but what the rival's last pick cannot change is worked
 * out once for all of them, and the search stops when no champion left can beat
 * the best one found.
 */
export function replyScorer(base: AiContext, free: readonly string[]) {
	const index = indexContent(base.content);
	const own = base.picks[base.team] ?? [];
	const enemy = base.picks[base.rival] ?? [];
	const allies = selectedChampions(own, index.champions);
	const roster = index.rosters.get(base.team);
	const trusted = roster?.size === ROLES.length;
	const baseUnavailable = new Set([
		...own,
		...enemy,
		...base.bans.filter((b) => b !== null),
	]);
	const liveOwn = own.filter((id) => !base.bans.includes(id));
	const composition = compositionFor(allies);
	const identity = identityFor(base.content.identities, allies);
	const takeable = new Map<Role, boolean>();
	const canTake = (role: Role) => {
		let ok = takeable.get(role);
		if (ok === undefined) {
			ok = canAssign(allies, role);
			takeable.set(role, ok);
		}
		return ok;
	};
	const turn = DRAFT_ORDER[base.step];
	const sideTurn = turn?.order === base.order && turn.action === "pick";
	const sideKind =
		sideTurn && base.order === "first" && phaseAt(base.step) === "picks1"
			? "flex"
			: sideTurn &&
					base.order === "last" &&
					base.step === DRAFT_ORDER.length - 1
				? "matchup"
				: "none";
	const poolIds = new Set<string>();
	for (const player of roster?.values() ?? [])
		for (const id of [...player.mains, ...player.secondary]) poolIds.add(id);

	const fixed: Fixed[] = free.map((champion) => {
		const candidate = index.champions.get(champion);
		if (!candidate) {
			return {
				champion,
				candidate,
				lanes: [],
				synergy: 0,
				composition: 0,
				identity: 0,
				fearless: 0,
				flexRoles: undefined,
				flexBound: 0,
				bound: 0,
			};
		}
		const lanes = lanesOf(index, base.team, champion).filter((lane) =>
			canTake(lane.role),
		);
		const flexRoles =
			trusted && lanes.length > 1 ? lanes.map((l) => l.role) : undefined;
		const trustedRoles = flexRoles
			? lanes.filter((l) => l.comfort > 0).length
			: 0;
		const flexBound = trustedRoles > 1 ? (trustedRoles - 1) * 2 * SCALE : 0;
		let laneBound = 0;
		let matchupBound = 0;
		if (lanes.length) {
			laneBound = Number.NEGATIVE_INFINITY;
			for (const lane of lanes) {
				const top = lane.row ? topOf(lane.row) : 0;
				if (top > matchupBound) matchupBound = top;
				const laneTop = lane.meta + lane.comfort + top;
				if (laneTop > laneBound) laneBound = laneTop;
			}
		}
		const rest = {
			synergy: synergy(index.synergies.get(champion), liveOwn, []),
			composition: composition(candidate),
			identity: identity(candidate),
			fearless: fearlessReserve(base, candidate),
		};
		const sideBound =
			sideKind === "flex"
				? flexBound
				: sideKind === "matchup"
					? matchupBound
					: 0;
		return {
			champion,
			candidate,
			lanes,
			...rest,
			flexRoles,
			flexBound,
			bound:
				laneBound +
				flexBound +
				sideBound +
				rest.synergy +
				rest.composition +
				rest.identity +
				rest.fearless,
		};
	});
	// Best bound first, so the search ends as soon as the next one cannot win.
	const order = [...fixed].sort((a, b) => b.bound - a.bound);

	/** The best reply when the rival's last pick is `last`; undefined without a free champion. */
	return (last: string): string | undefined => {
		const rivals = selectedChampions([...enemy, last], index.champions);
		const sharing = new Map<Role, readonly Champion[]>();
		const rivalsIn = (role: Role) => {
			let list = sharing.get(role);
			if (!list) {
				list = rivalsInRole(rivals, role);
				sharing.set(role, list);
			}
			return list;
		};
		const lastInPools = poolIds.has(last);
		let unavailable: Set<string> | undefined;
		let best: string | undefined;
		let bestTotal = Number.MIN_SAFE_INTEGER;
		for (const item of order) {
			// One point of margin keeps rounding of the bound from ever pruning a winner.
			if (best !== undefined && item.bound + 1 < bestTotal) break;
			if (item.champion === last) continue;
			let laneBest = Number.MIN_SAFE_INTEGER;
			let laneMeta = 0;
			let laneComfort = 0;
			let laneMatchup = 0;
			for (const lane of item.lanes) {
				const matchup = worstMatchup(lane.row, rivalsIn(lane.role));
				const total = lane.meta + lane.comfort + matchup;
				if (total > laneBest) {
					laneMeta = lane.meta;
					laneComfort = lane.comfort;
					laneMatchup = matchup;
					laneBest = total;
				}
			}
			let flexPoints = 0;
			if (item.flexRoles && item.candidate) {
				if (lastInPools) {
					unavailable ??= new Set([...baseUnavailable, last]);
					flexPoints = flex(
						item.candidate,
						item.flexRoles,
						allies,
						roster,
						unavailable,
					);
				} else {
					item.baseFlex ??= flex(
						item.candidate,
						item.flexRoles,
						allies,
						roster,
						baseUnavailable,
					);
					flexPoints = item.baseFlex;
				}
			}
			const sidePoints =
				sideKind === "flex"
					? flexPoints
					: sideKind === "matchup"
						? laneMatchup > 0
							? laneMatchup
							: 0
						: 0;
			// The order of the sum is the one of `pickTotal`.
			const total =
				laneMeta +
				laneComfort +
				laneMatchup +
				item.synergy +
				item.composition +
				flexPoints +
				item.identity +
				item.fearless +
				sidePoints;
			if (
				total > bestTotal ||
				(total === bestTotal && (best === undefined || item.champion < best))
			) {
				best = item.champion;
				bestTotal = total;
			}
		}
		return best;
	};
}
