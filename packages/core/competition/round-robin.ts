import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";

/** One series between two teams. Order carries no meaning (no home side in LoL). */
export interface Fixture {
	readonly a: string;
	readonly b: string;
}

/** What each team does on one match day: the fixtures and who rests. */
export interface Matchday {
	readonly fixtures: readonly Fixture[];
	readonly byes: readonly string[];
}

/**
 * Round robin by the circle method: one team stays fixed and the rest rotate.
 * With an odd count a placeholder takes the spare slot, so each day one team
 * rests and over a lap everybody rests once. The N laps repeat the same days.
 */
export function roundRobin(
	teams: readonly string[],
	rounds: 1 | 2,
): Matchday[] {
	if (teams.length < 2) {
		throw new RangeError("A round robin needs at least two teams");
	}
	if (new Set(teams).size !== teams.length) {
		throw new RangeError("Team ids must be unique");
	}
	const ring: (string | null)[] = [...teams];
	if (ring.length % 2 === 1) ring.push(null);
	const half = ring.length / 2;
	const lap: Matchday[] = [];
	for (let day = 0; day < ring.length - 1; day++) {
		const fixtures: Fixture[] = [];
		const byes: string[] = [];
		for (let i = 0; i < half; i++) {
			const a = ring[i] as string | null;
			const b = ring[ring.length - 1 - i] as string | null;
			if (a !== null && b !== null) fixtures.push({ a, b });
			else if (a !== null || b !== null) byes.push((a ?? b) as string);
		}
		lap.push({ fixtures, byes });
		// Rotate everything but the first team one place.
		ring.splice(1, 0, ring.pop() as string | null);
	}
	return Array.from({ length: rounds }, () => lap).flat();
}

/** Where a draw belongs: ids of the competition and season (indexes), the stage and the match day. */
export interface PriorityScope {
	readonly competition: number;
	readonly season: number;
	readonly stage: number;
	readonly round: number;
}

/**
 * Game-1 priority in league play (decision 8 of plan 12): a coin per fixture
 * from the `competition` scope. Each fixture has its own seed (by position), so
 * a draw never depends on the other fixtures of the day. Returns the team with
 * priority for each fixture, in order.
 */
export function drawGame1Priority(
	rootSeed: number,
	scope: PriorityScope,
	fixtures: readonly Fixture[],
): string[] {
	return fixtures.map(({ a, b }, index) => {
		const rng = createRng(
			deriveSeed(
				rootSeed,
				SCOPES.competition,
				scope.competition,
				scope.season,
				scope.stage,
				scope.round,
				index,
			),
		);
		return int(rng, 0, 1) === 0 ? a : b;
	});
}
