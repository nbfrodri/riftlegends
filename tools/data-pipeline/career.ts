import { historySpan } from "./scope.ts";

/** One past season of a player at the top level (see history.ts). */
export interface Season {
	year: number;
	/** Games in a main league. */
	games: number;
	/** Different international events played (Worlds, MSI, First Stand). */
	internationalEvents: number;
	/** League playoffs won. */
	titles: number;
	/** International events won. */
	internationalTitles: number;
}

/** Seasons count 15 % less for every year they are further away. */
export const careerDecay = 0.85;
/** Games of a full league season; more does not add anything. */
const fullSeasonGames = 80;
const points = { event: 0.5, title: 1, internationalTitle: 2 } as const;
/** A career score of this value earns half of the maximum. */
const halfScore = 4;
/** Most points the career adds to the level. */
export const careerLevelCap = 8;

/**
 * Career strength between 0 (no top-level history) and 1 (never reached).
 * Each past season scores its games (up to a full season), international
 * events and titles, weighted by `careerDecay` per year of age; the sum
 * saturates as score / (score + halfScore).
 */
export function careerStrength(seasons: readonly Season[], current: number) {
	let score = 0;
	for (const entry of seasons) {
		const age = current - entry.year;
		if (age < 1 || age > historySpan) continue;
		score +=
			careerDecay ** (age - 1) *
			(Math.min(entry.games / fullSeasonGames, 1) +
				points.event * entry.internationalEvents +
				points.title * entry.titles +
				points.internationalTitle * entry.internationalTitles);
	}
	return score / (score + halfScore);
}
