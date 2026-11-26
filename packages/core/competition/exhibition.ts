import type { Competition } from "@rift-legends/contracts";
import { packagedMatchContent } from "../content/match";
import { loadRealContent } from "../content/real";
import cblol from "../content/real/formats/cblol.json";
import firstStand from "../content/real/formats/first-stand.json";
import lck from "../content/real/formats/lck.json";
import lcp from "../content/real/formats/lcp.json";
import lcs from "../content/real/formats/lcs.json";
import lec from "../content/real/formats/lec.json";
import lpl from "../content/real/formats/lpl.json";
import msi from "../content/real/formats/msi.json";
import worlds from "../content/real/formats/worlds.json";

// The exhibition season of plan 31 (decision 1): before a career exists,
// «Competición» plays a whole AI-only season with these formats.

const REAL_FORMATS = [lck, lpl, lec, lcp, lcs, cblol, firstStand, msi, worlds];

/** The fictional league of the packaged teams, for offline tests and captures. */
const FICTIONAL_LEAGUE = "rift-league";

const window = (startWeek: number, weeks: number) => ({
	startWeek,
	weeks,
	matchDays: 2,
	maxSeriesPerDay: 4,
});

function fictionalLeague(teams: readonly string[]): Competition {
	return {
		id: FICTIONAL_LEAGUE,
		kind: "league",
		verified: false,
		tiebreakerBestOf: 3,
		tiebreak: ["seriesWins", "gameDiff", "headToHead", "draw"],
		stages: [
			{
				id: "regular",
				window: window(1, 4),
				entrants: { kind: "fixed", teams: [...teams] },
				play: { type: "roundRobin", size: teams.length, rounds: 1, bestOf: 1 },
			},
			{
				id: "playoffs",
				window: window(6, 2),
				entrants: { kind: "standing", stage: "regular", from: 1, to: 4 },
				play: { type: "singleElim", size: 4, bestOf: [3, 5] },
			},
		],
	} as Competition;
}

/** The `season.exhibition` query: a `season.create` body without its seed. */
export function exhibitionSeason({
	content = "real",
}: {
	content?: "fictional" | "real";
}) {
	if (content === "fictional") {
		const teams = packagedMatchContent.teams;
		return {
			year: 2026,
			competitions: [fictionalLeague(teams.map(({ id }) => id))],
			teams: teams.map(({ id, seed }) => ({
				id,
				competition: FICTIONAL_LEAGUE,
				region: FICTIONAL_LEAGUE,
				rank: seed,
			})),
		};
	}
	const { match, season } = loadRealContent();
	return {
		year: season,
		competitions: REAL_FORMATS as unknown as Competition[],
		teams: match.teams.flatMap(({ id, league, seed }) =>
			league ? [{ id, competition: league, region: league, rank: seed }] : [],
		),
	};
}
