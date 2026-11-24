import type { BestOf, Bracket, Slot } from "./bracket";

// Fills a bracket with teams from the results played so far (plan 12, B4, B6).

type MatchStatus = "waiting" | "ready" | "done" | "skipped";

interface ResolvedMatch {
	id: string;
	side: "upper" | "lower" | "final" | "reset";
	round: number;
	bestOf: BestOf;
	teamA: string | null;
	teamB: string | null;
	/** Better seed, who has the priority of game 1 (no rival choice). */
	priority: { team: string; seed: number; otherSeed: number } | null;
	status: MatchStatus;
	winner: string | null;
	loser: string | null;
}

export interface BracketState {
	matches: ResolvedMatch[];
	champion: string | null;
	/** Series lost by each team so far. */
	losses: Record<string, number>;
}

/**
 * `teams` go from best to worst seed. `results` maps a match id to its
 * winner. A result for a match that cannot be played yet, or for a team that
 * is not in it, is a bug of the caller and throws.
 */
export const resolveBracket = (
	bracket: Bracket,
	teams: readonly string[],
	results: Readonly<Record<string, string>>,
): BracketState => {
	if (teams.length !== bracket.size) {
		throw new RangeError(`Expected ${bracket.size} teams, got ${teams.length}`);
	}
	const byId = new Map<string, ResolvedMatch>();
	const seedOf = (team: string) => teams.indexOf(team) + 1;
	const priorityOf = (a: string, b: string) => {
		const [seedA, seedB] = [seedOf(a), seedOf(b)];
		return seedA < seedB
			? { team: a, seed: seedA, otherSeed: seedB }
			: { team: b, seed: seedB, otherSeed: seedA };
	};
	const teamOf = (slot: Slot): string | null => {
		if (slot.kind === "seed") return teams[slot.rank - 1] ?? null;
		const m = byId.get(slot.match);
		return (slot.kind === "winner" ? m?.winner : m?.loser) ?? null;
	};
	const losses: Record<string, number> = {};
	for (const m of bracket.matches) {
		const teamA = teamOf(m.a);
		const teamB = teamOf(m.b);
		const played = results[m.id] ?? null;
		const grand = m.side === "reset" ? byId.get("GF") : undefined;
		// The reset final is only played if the lower-bracket team won the final.
		const skipped = grand?.winner != null && grand.winner === teamA;
		const ready =
			teamA !== null &&
			teamB !== null &&
			!skipped &&
			(grand === undefined || grand.winner != null);
		if (played !== null && (!ready || (played !== teamA && played !== teamB))) {
			throw new RangeError(`Invalid result for match ${m.id}`);
		}
		const loser = played === null ? null : played === teamA ? teamB : teamA;
		if (loser !== null) losses[loser] = (losses[loser] ?? 0) + 1;
		byId.set(m.id, {
			id: m.id,
			side: m.side,
			round: m.round,
			bestOf: m.bestOf,
			teamA,
			teamB,
			priority: ready ? priorityOf(teamA, teamB) : null,
			status: skipped
				? "skipped"
				: played !== null
					? "done"
					: ready
						? "ready"
						: "waiting",
			winner: played,
			loser,
		});
	}
	const matches = bracket.matches.map((m) => byId.get(m.id) as ResolvedMatch);
	const last = matches[matches.length - 1] as ResolvedMatch;
	if (bracket.upperChampion) {
		// No grand final: the upper winner is first once the lower final is played.
		const done = last.status === "done";
		return {
			matches,
			champion: done ? teamOf(bracket.upperChampion) : null,
			losses,
		};
	}
	const decider =
		last.status === "skipped"
			? (matches[matches.length - 2] as ResolvedMatch)
			: last;
	return { matches, champion: decider.winner, losses };
};
