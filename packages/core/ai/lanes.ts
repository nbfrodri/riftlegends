import type { Role } from "@rift-legends/contracts";
import { comfort } from "./components/comfort";
import { meta } from "./components/meta";
import type { indexContent } from "./content-index";

/** What a champion is worth in one lane for a team, whatever the picks are. */
export interface Lane {
	readonly role: Role;
	readonly meta: number;
	readonly comfort: number;
	/** Matchups of the champion in this lane, by opponent. */
	readonly row: ReadonlyMap<string, number> | undefined;
}

type Index = ReturnType<typeof indexContent>;
const cache = new WeakMap<Index, Map<string, Map<string, readonly Lane[]>>>();

/** The lanes of `champion` for `team`, in the order of the content; read once per content. */
export function lanesOf(
	index: Index,
	team: string,
	champion: string,
): readonly Lane[] {
	let byTeam = cache.get(index);
	if (!byTeam) {
		byTeam = new Map();
		cache.set(index, byTeam);
	}
	let byChampion = byTeam.get(team);
	if (!byChampion) {
		byChampion = new Map();
		byTeam.set(team, byChampion);
	}
	let lanes = byChampion.get(champion);
	if (!lanes) {
		const roster = index.rosters.get(team);
		lanes =
			index.champions.get(champion)?.positions.map(({ role, tier }) => ({
				role,
				meta: meta(tier),
				comfort: comfort(roster?.get(role), champion),
				row: index.matchups.get(champion)?.get(role),
			})) ?? [];
		byChampion.set(champion, lanes);
	}
	return lanes;
}
