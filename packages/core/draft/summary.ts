import {
	GAP_RATING,
	ROLES,
	type Role,
	type SeriesSummary,
	type Side,
} from "@rift-legends/contracts";
import type { Emitted } from "../server/dispatcher";
import type { SeriesState } from "./series";

interface Line {
	player: string;
	team: string;
	champion: string;
	kills: number;
	deaths: number;
	assists: number;
	gold: number;
	participation: number;
	rating: number;
}

/** Integer division, rounding down. */
const div = (n: number, d: number) => (n - (n % d)) / d;

/**
 * The lines of a game's `match.ended`: blue's five in role order, then red's
 * (the order `playerStats` writes them in).
 */
const linesOf = (facts: readonly Emitted[]): Line[] =>
	(facts.find((f) => f.type === "match.ended")?.players as
		| Line[]
		| undefined) ?? [];

const winnerOf = (facts: readonly Emitted[]) =>
	facts.find((f) => f.type === "match.ended")?.winner as string | undefined;

/** The team with more game wins; null while they are level. */
function seriesWinner(winners: readonly (string | undefined)[]) {
	const wins = new Map<string, number>();
	for (const team of winners)
		if (team) wins.set(team, (wins.get(team) ?? 0) + 1);
	const [first, second] = [...wins].sort((a, b) => b[1] - a[1]);
	return first && first[1] !== second?.[1] ? first[0] : null;
}

/** The series MVP, only among the series winner's players (#437). */
function mvpOf(
	games: readonly Line[][],
	winner: string | null,
): SeriesSummary["mvp"] {
	const totals = new Map<
		string,
		{ line: Line; role: number; order: number; ratings: number } & {
			champions: string[];
			kills: number;
			deaths: number;
			assists: number;
			participation: number;
			games: number;
		}
	>();
	for (const lines of games) {
		lines.forEach((line, index) => {
			const total = totals.get(line.player) ?? {
				line,
				role: index % ROLES.length,
				order: totals.size,
				ratings: 0,
				champions: [],
				kills: 0,
				deaths: 0,
				assists: 0,
				participation: 0,
				games: 0,
			};
			total.ratings += line.rating;
			total.kills += line.kills;
			total.deaths += line.deaths;
			total.assists += line.assists;
			total.participation += line.participation;
			total.champions.push(line.champion);
			total.games += 1;
			totals.set(line.player, total);
		});
	}
	// Only the series winner's players, or everyone while wins are level.
	// Best mean rating (every player plays every game, so sums compare the
	// same); then more participation; then the earlier role; then the team
	// that was blue in game 1 (first seen).
	const [best] = [...totals.values()]
		.filter((total) => winner === null || total.line.team === winner)
		.sort(
			(a, b) =>
				b.ratings - a.ratings ||
				b.participation - a.participation ||
				a.role - b.role ||
				a.order - b.order,
		);
	if (!best) return null;
	return {
		player: best.line.player,
		team: best.line.team,
		champions: best.champions,
		rating: div(best.ratings * 10, best.games),
		kills: best.kills,
		deaths: best.deaths,
		assists: best.assists,
		participation: div(best.participation, best.games),
		games: best.games,
	};
}

/** Per role: blue minus red, the side ahead and whether it is a gap. */
function lanesOf(
	lines: readonly Line[],
): SeriesSummary["lanes"][number]["lines"] {
	const half = ROLES.length;
	return ROLES.map((role: Role, i) => {
		const blue = lines[i] as Line;
		const red = lines[half + i] as Line;
		const rating = blue.rating - red.rating;
		const favored: Side | null =
			rating > 0 ? "blue" : rating < 0 ? "red" : null;
		return {
			role,
			rating,
			gold: blue.gold - red.gold,
			favored,
			gap: rating > GAP_RATING || rating < -GAP_RATING,
		};
	});
}

/**
 * MVP of the series (from its winner) and the lane gaps of each game, read from the stored
 * `match.ended` facts; nothing is simulated again (plan 09, Q5).
 */
export function summarizeSeries(
	matches: readonly (readonly Emitted[])[],
): SeriesSummary {
	const games = matches.map(linesOf);
	return {
		mvp: mvpOf(games, seriesWinner(matches.map(winnerOf))),
		lanes: games.map((lines, i) => ({ game: i + 1, lines: lanesOf(lines) })),
	};
}

/** The `series.summary` query. */
export const viewSummary = (state: SeriesState): SeriesSummary =>
	summarizeSeries(state.matches);
