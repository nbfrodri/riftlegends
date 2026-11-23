/** Twenty ratings from 0 to 100, in the order in plan 08. */
export const PLAYER_ATTRIBUTES = [
	"lanes",
	"farming",
	"waves",
	"macro",
	"roaming",
	"vision",
	"anticipation",
	"objectiveControl",
	"teamfight",
	"mechanics",
	"positioning",
	"aggression",
	"composure",
	"resilience",
	"experience",
	"consistency",
	"focus",
	"shotcalling",
	"communication",
	"versatility",
] as const;

export type PlayerAttribute = (typeof PLAYER_ATTRIBUTES)[number];

/**
 * Attributes that matter little for a role, so the UI dims them. A display
 * hint only: the simulation does not read it. Roles as in `ROLES`.
 */
export const LOW_RELEVANCE: Record<
	"top" | "jungle" | "mid" | "bot" | "support",
	readonly PlayerAttribute[]
> = {
	top: ["roaming"],
	jungle: ["waves"],
	mid: [],
	bot: ["roaming"],
	support: ["farming", "waves"],
};
