import type { AiContent, Role } from "@rift-legends/contracts";

export type Champion = AiContent["champions"][number];
type Player = AiContent["players"][number];
type LaneMatchups = Map<Role, Map<string, number>>;
export type Roster = ReadonlyMap<Role, Player>;

function buildIndex(content: AiContent) {
	const champions = new Map(content.champions.map((c) => [c.id, c]));
	const rosters = new Map<string, Map<Role, Player>>();
	for (const player of content.players) {
		const roster = rosters.get(player.team) ?? new Map<Role, Player>();
		// The first starter of each role plays; a sub only fills an empty role.
		const fielded = roster.get(player.role);
		if (fielded && (player.sub || !fielded.sub)) continue;
		const playable = (id: string) =>
			champions.get(id)?.positions.some((p) => p.role === player.role);
		roster.set(player.role, {
			...player,
			mains: player.mains.filter(playable),
			secondary: player.secondary.filter(playable),
		});
		rosters.set(player.team, roster);
	}
	const matchups = new Map<string, LaneMatchups>();
	for (const matchup of content.matchups) {
		const lanes =
			matchups.get(matchup.champion) ?? new Map<Role, Map<string, number>>();
		const opponents = lanes.get(matchup.role) ?? new Map<string, number>();
		opponents.set(matchup.against, matchup.value);
		lanes.set(matchup.role, opponents);
		matchups.set(matchup.champion, lanes);
	}
	const synergies = new Map<string, Map<string, number>>();
	function link(a: string, b: string, value: number) {
		const partners = synergies.get(a) ?? new Map<string, number>();
		partners.set(b, value);
		synergies.set(a, partners);
	}
	for (const { a, b, value } of content.synergies) {
		link(a, b, value);
		link(b, a, value);
	}
	return { champions, rosters, matchups, synergies };
}

const indexes = new WeakMap<AiContent, ReturnType<typeof buildIndex>>();

/** Each loaded content snapshot has its own index, shared across draft turns. */
export function indexContent(content: AiContent) {
	const cached = indexes.get(content);
	if (cached) return cached;
	const index = buildIndex(content);
	indexes.set(content, index);
	return index;
}

export function selectedChampions(
	ids: readonly string[],
	champions: ReadonlyMap<string, Champion>,
) {
	return ids.flatMap((id) => champions.get(id) ?? []);
}
