import { shuffle } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";

export interface SwissTeam {
	readonly id: string;
	/** Used to keep teams of one region apart in round 1. */
	readonly region?: string;
}

export interface SwissRules {
	/** Wins that qualify. */
	readonly wins: number;
	/** Losses that eliminate. */
	readonly losses: number;
	/** Bo of an ordinary series. */
	readonly bestOf: number;
	/** Bo of a series where a win qualifies or a loss eliminates. */
	readonly decisiveBestOf: number;
	/** Constraints to keep while pairing, relaxed in a fixed order when impossible. */
	readonly avoid: readonly ("region" | "rematch")[];
}

/** A played series, by team id. */
export interface SwissResult {
	readonly winner: string;
	readonly loser: string;
}

export interface SwissRow {
	readonly id: string;
	readonly wins: number;
	readonly losses: number;
	readonly status: "active" | "qualified" | "eliminated";
}

interface SwissPairing {
	/** The better seed of the two. */
	readonly a: string;
	readonly b: string;
	readonly bestOf: number;
	/** Team with game-1 priority, drawn with the `competition` stream. */
	readonly priority: string;
	/** Why they meet: round-1 pots, same record, or different records (last resort). */
	readonly reason: "pots" | "same-record" | "cross-record";
}

export interface SwissRound {
	readonly round: number;
	readonly pairings: readonly SwissPairing[];
	/** Constraints dropped to pair, in the order they were dropped. */
	readonly relaxed: readonly ("region" | "rematch" | "record")[];
}

export interface SwissScope {
	/** Indexes of competition, season and stage (never hashes of text ids). */
	readonly competition: number;
	readonly season: number;
	readonly stage: number;
}

/** Records and status after the rounds played so far. */
export function swissStandings(
	teams: readonly SwissTeam[],
	played: readonly (readonly SwissResult[])[],
	rules: Pick<SwissRules, "wins" | "losses">,
): SwissRow[] {
	const record = new Map(
		teams.map((team) => [team.id, [0, 0] as [number, number]]),
	);
	for (const { winner, loser } of played.flat()) {
		const won = record.get(winner);
		const lost = record.get(loser);
		if (won === undefined || lost === undefined) {
			throw new RangeError(`Unknown team in result ${winner} vs ${loser}`);
		}
		won[0] += 1;
		lost[1] += 1;
	}
	return teams.map(({ id }) => {
		const [wins, losses] = record.get(id) as [number, number];
		const status =
			wins >= rules.wins
				? "qualified"
				: losses >= rules.losses
					? "eliminated"
					: "active";
		return { id, wins, losses, status };
	});
}

/**
 * Depth-first search for a perfect matching: the first unpaired team of
 * `order` tries the later teams in order, and backtracks when the rest cannot
 * be paired.
 */
function findMatching<T>(
	order: readonly T[],
	allowed: (a: T, b: T) => boolean,
): [T, T][] | null {
	const used = new Array<boolean>(order.length).fill(false);
	const pairs: [T, T][] = [];
	const solve = (): boolean => {
		const first = used.indexOf(false);
		if (first === -1) return true;
		used[first] = true;
		for (let other = first + 1; other < order.length; other++) {
			if (used[other] || !allowed(order[first] as T, order[other] as T)) {
				continue;
			}
			used[other] = true;
			pairs.push([order[first] as T, order[other] as T]);
			if (solve()) return true;
			pairs.pop();
			used[other] = false;
		}
		used[first] = false;
		return false;
	};
	return solve() ? pairs : null;
}

const UINT32_MAX = 0xffffffff;

/** Round-1 pots by seed: four equal pots meet 1 v 4 and 2 v 3; other sizes split top and bottom half. */
function potOf(rank: number, size: number): number {
	if (size % 4 !== 0) return rank < size / 2 ? 0 : 3;
	return (rank * 4 - ((rank * 4) % size)) / size;
}

/** Pairs the next Swiss round, or returns null when the stage is over. */
export function pairSwissRound(
	teams: readonly SwissTeam[],
	played: readonly (readonly SwissResult[])[],
	rules: SwissRules,
	rootSeed: number,
	scope: SwissScope,
): SwissRound | null {
	const rows = new Map(
		swissStandings(teams, played, rules).map((row) => [row.id, row]),
	);
	const seedOf = new Map(teams.map((team, seed) => [team.id, seed]));
	const active = teams.filter((team) => rows.get(team.id)?.status === "active");
	if (active.length === 0) return null;

	const round = played.length + 1;
	const record = (id: string) => rows.get(id) as SwissRow;
	const sameRecord = (a: string, b: string) =>
		record(a).wins === record(b).wins && record(a).losses === record(b).losses;
	const shuffled =
		round > 1
			? active
			: shuffle(
					createRng(
						deriveSeed(
							rootSeed,
							SCOPES.competition,
							scope.competition,
							scope.season,
							scope.stage,
							round,
							UINT32_MAX,
						),
					),
					active,
				);
	const order = [...shuffled].sort(
		(x, y) =>
			record(y.id).wins - record(x.id).wins ||
			record(x.id).losses - record(y.id).losses ||
			(seedOf.get(x.id) as number) - (seedOf.get(y.id) as number),
	);
	const matching = findMatching(order, (x, y) => {
		if (round === 1) {
			return (
				potOf(seedOf.get(x.id) as number, teams.length) +
					potOf(seedOf.get(y.id) as number, teams.length) ===
					3 &&
				!(
					rules.avoid.includes("region") &&
					x.region !== undefined &&
					x.region === y.region
				)
			);
		}
		return sameRecord(x.id, y.id);
	});
	if (matching === null) throw new RangeError("Swiss round cannot be paired");
	return {
		round,
		relaxed: [],
		pairings: matching
			.map(([x, y]) =>
				(seedOf.get(x.id) as number) < (seedOf.get(y.id) as number)
					? { a: x, b: y }
					: { a: y, b: x },
			)
			.sort(
				(p, q) =>
					(seedOf.get(p.a.id) as number) - (seedOf.get(q.a.id) as number),
			)
			.map(({ a, b }) => ({
				a: a.id,
				b: b.id,
				bestOf: rules.bestOf,
				priority: a.id,
				reason: round === 1 ? "pots" : "same-record",
			})),
	};
}
