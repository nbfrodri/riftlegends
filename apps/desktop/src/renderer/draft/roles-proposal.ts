import { ROLES, type Role, type SeriesOptions } from "@rift-legends/contracts";

export type Lineup = Record<Role, string>;
type Positions = SeriesOptions["positions"];

const TIER_SCORE: Record<string, number> = {
	"S+": 5,
	S: 4,
	A: 3,
	B: 2,
	C: 1,
	D: 0,
};
/** Worse than any tier: a champion nobody plays in that role. */
const OFF_ROLE = -100;

/**
 * The most plausible lineup for five picks: the assignment that maximises the
 * tier of each champion in its role. Ties keep the pick order (the earliest
 * pick takes the earliest role), like the AI does with `ROLES` order.
 */
export function suggestRoles(
	picks: readonly string[],
	positions: Positions,
): Lineup {
	const fit = (champion: string, role: Role) => {
		const tier = positions[champion]?.find((p) => p.role === role)?.tier;
		return tier ? (TIER_SCORE[tier] ?? OFF_ROLE) : OFF_ROLE;
	};
	let best: { score: number; order: string[] } | null = null;
	const permute = (taken: readonly number[], score: number) => {
		const role = ROLES[taken.length];
		if (!role) {
			if (!best || score > best.score)
				best = { score, order: taken.map((i) => picks[i] as string) };
			return;
		}
		picks.forEach((champion, i) => {
			if (!taken.includes(i))
				permute([...taken, i], score + fit(champion, role));
		});
	};
	permute([], 0);
	const order = (best as { order: string[] } | null)?.order ?? [...picks];
	return Object.fromEntries(
		ROLES.map((role, i) => [role, order[i] as string]),
	) as Lineup;
}
