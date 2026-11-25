import {
	computeStandings,
	type SeriesResult,
	type Standings,
	type StandingsInput,
} from "./standings";
import { orderTies, winnerOf } from "./tiebreak";

interface CrossGroupInput
	extends Omit<StandingsInput, "teams" | "results" | "cuts"> {
	readonly groups: readonly [readonly string[], readonly string[]];
	readonly results: readonly (SeriesResult & {
		readonly groupPoints: number;
	})[];
	readonly cuts: Readonly<Record<"winner" | "loser", readonly number[]>>;
}

interface GroupTable extends Standings {
	readonly points: number;
}

/** Group points select the winning group. Team records use unweighted series wins. */
export function computeGroupStandings(
	input: CrossGroupInput,
): Record<"winner" | "loser", GroupTable> {
	const {
		groups: [left, right],
		cuts,
		results,
		tiebreakerResults = [],
		...context
	} = input;
	const leftTeams = new Set(left);
	const rightTeams = new Set(right);
	let leftPoints = 0;
	let rightPoints = 0;
	for (const series of results) {
		if (
			!(leftTeams.has(series.a) && rightTeams.has(series.b)) &&
			!(rightTeams.has(series.a) && leftTeams.has(series.b))
		)
			throw new RangeError("Expected a series across the two groups");
		if (!Number.isSafeInteger(series.groupPoints) || series.groupPoints < 1)
			throw new RangeError("Expected positive group points");
		if (leftTeams.has(winnerOf(series))) leftPoints += series.groupPoints;
		else rightPoints += series.groupPoints;
	}
	// The available Cup rules only specify the group points.
	const leftWins =
		leftPoints === rightPoints
			? orderTies(["left", "right"], {
					...context,
					cuts: [],
					criteria: ["draw"],
					results: [],
					tiebreakerResults: [],
				}).order[0] === "left"
			: leftPoints > rightPoints;
	const table = (
		teams: readonly string[],
		opponents: readonly string[],
		points: number,
		group: "winner" | "loser",
	) => ({
		points,
		...computeStandings({
			...context,
			results,
			teams,
			opponents,
			cuts: cuts[group],
			tiebreakerResults: tiebreakerResults.filter(
				({ a, b }) => teams.includes(a) && teams.includes(b),
			),
		}),
	});
	return {
		winner: leftWins
			? table(left, right, leftPoints, "winner")
			: table(right, left, rightPoints, "winner"),
		loser: leftWins
			? table(right, left, rightPoints, "loser")
			: table(left, right, leftPoints, "loser"),
	};
}
