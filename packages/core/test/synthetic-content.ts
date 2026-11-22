import {
	type AiContent,
	type MatchContent,
	PLAYER_ATTRIBUTES,
	ROLES,
} from "@rift-legends/contracts";
import { fictionalMatchContent } from "../match/fixtures/content";

/**
 * Plain content for any pool and two teams: every champion plays every role
 * and every player is average. It lets the draft tests play their games
 * through `match.play` without the fictional pool's limits.
 */
export function syntheticContent(
	pool: readonly string[],
	teams: readonly [string, string],
): { draft: AiContent; match: MatchContent } {
	const average = Object.fromEntries(
		PLAYER_ATTRIBUTES.map((key) => [key, 60]),
	) as MatchContent["players"][number]["attributes"];
	const players = teams.flatMap((team) =>
		ROLES.map((role) => ({ id: `${team}-${role}`, team, role })),
	);
	return {
		draft: {
			champions: pool.map((id, i) => ({
				id,
				name: id,
				positions: ROLES.map((role) => ({ role, tier: "B" as const })),
				damage: i % 2 === 0 ? ("physical" as const) : ("magic" as const),
				archetypes: ["carry" as const],
				power: "mid" as const,
			})),
			matchups: [],
			synergies: [],
			identities: [{ id: "any", archetypes: ["carry"], threshold: 1 }],
			players: players.map((p) => ({
				...p,
				handle: p.id.replace(/[^A-Za-z0-9]/g, ""),
				level: 70,
				mains: pool.slice(0, 1),
				secondary: [],
				weak: [],
			})),
		},
		match: {
			players: players.map(({ id }) => ({
				id,
				attributes: average,
				leader: id.endsWith("-jungle"),
				mastery: [],
			})),
			teams: teams.map((id, index) => ({
				id,
				name: id,
				seed: index + 1,
				coach: { name: `${id} coach`, personality: "balanced", rating: 25 },
				chemistry: [],
				strategy: {
					tempo: "balanced" as const,
					objectives: "balanced" as const,
					risk: "balanced" as const,
				},
				adaptation: 50,
			})),
			champions: pool.map((id) => ({ id, cc: 4, mobility: 4, frontline: 4 })),
			rules: fictionalMatchContent.rules,
		},
	};
}
