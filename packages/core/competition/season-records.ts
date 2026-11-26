import { viewMatch } from "../draft/match-view";
import { summarizeSeries } from "../draft/summary";
import type { Emitted } from "../server/dispatcher";
import { QueryRejection } from "../server/dispatcher";
import type { SeasonSession } from "./handlers";
import {
	type Fearless,
	playSeasonSeries,
	type SeasonFixture,
} from "./season-series";

/** A player's line in a game, as `match.ended` writes it. */
interface GameLine {
	readonly player: string;
	readonly team: string;
	readonly champion: string;
	readonly kills: number;
	readonly deaths: number;
	readonly assists: number;
}

/**
 * What the season keeps of a played series: its result and the lines of each
 * game, for the team profiles, plus its fixture and seed to play it again
 * (the same inputs give the same games) when a view asks for its detail.
 */
export interface SeriesRecord {
	readonly id: string;
	readonly competition: string;
	readonly stage: string;
	readonly day: number;
	readonly teams: readonly [string, string];
	readonly score: readonly [number, number];
	readonly winner: string;
	readonly fixture: SeasonFixture;
	readonly seed: number;
	readonly fearless: Fearless;
	readonly games: readonly {
		readonly duration: number;
		readonly lines: readonly GameLine[];
	}[];
}

export function gamesOf(facts: readonly Emitted[]): SeriesRecord["games"] {
	return facts.flatMap((fact) =>
		fact.type === "match.ended"
			? [
					{
						duration: fact.duration as number,
						lines: fact.players as readonly GameLine[],
					},
				]
			: [],
	);
}

function replay(state: SeasonSession, series: string) {
	const season = state.season;
	const record = season?.records.get(series);
	if (!season || !record)
		return new QueryRejection({ code: "unknown-series", params: { series } });
	const played = playSeasonSeries(
		season.content,
		record.fixture,
		record.seed,
		record.fearless,
	);
	if (!played.ok)
		return new QueryRejection({ code: played.error.code, params: {} });
	return played.state;
}

export function seriesSummary(
	state: SeasonSession,
	{ series }: { series: string },
) {
	const replayed = replay(state, series);
	return replayed instanceof QueryRejection
		? replayed
		: summarizeSeries(replayed.matches);
}

export function seriesMatch(
	state: SeasonSession,
	{ series, game }: { series: string; game: number },
) {
	const replayed = replay(state, series);
	return replayed instanceof QueryRejection
		? replayed
		: viewMatch(replayed, { game });
}
