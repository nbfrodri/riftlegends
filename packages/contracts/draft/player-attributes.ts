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
