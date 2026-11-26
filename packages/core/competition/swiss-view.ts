import { min } from "../math/int";
import type { RunningSeason } from "./handlers";
import type { SeasonFixture } from "./season-series";
import type { StageProgress } from "./season-stages";
import { localFixtureId } from "./season-stages";
import type { StageNode, StageRef } from "./stage-model";
import { swissStandings } from "./swiss";

// The Swiss part of `competition.standings` (plan 31, U7, #487): each round
// with its series, the balance their teams brought to them and the
// constraints relaxed to pair it, then where each team stands.

type Relaxed = NonNullable<SeasonFixture["relaxed"]>;

interface SwissSeries {
	teams: readonly [string, string];
	record: [number, number];
	winner?: string;
	score?: [number, number];
	series?: string;
}

export function swissView(
	season: RunningSeason,
	node: StageNode,
	ref: StageRef,
	stage: StageProgress,
) {
	const play = node.stage.play;
	if (play.type !== "swiss") return undefined;
	const records = new Map(
		[...season.records.values()]
			.filter((r) => r.competition === ref.competition && r.stage === ref.stage)
			.map((r) => [localFixtureId(r.id), r.id]),
	);
	const played = stage.played.filter(({ fixture }) => !fixture.tiebreaker);
	const result = ({ fixture, winner }: (typeof played)[number]) => ({
		winner,
		loser: fixture.teams[0] === winner ? fixture.teams[1] : fixture.teams[0],
	});
	const pending = stage.fixtures.filter(({ tiebreaker }) => !tiebreaker);
	const teams = stage.standings.rows.map(({ team }) => ({ id: team }));
	const rounds = new Map<
		number,
		{ round: number; relaxed: Relaxed; series: SwissSeries[] }
	>();
	const roundOf = ({ round, relaxed = [] }: SeasonFixture) => {
		const entry = rounds.get(round) ?? { round, relaxed, series: [] };
		rounds.set(round, entry);
		return entry;
	};
	const before = (round: number) =>
		new Map(
			swissStandings(
				teams,
				[played.filter(({ fixture }) => fixture.round < round).map(result)],
				play,
			).map(({ id, wins, losses }) => [id, [wins, losses] as [number, number]]),
		);
	const recordAt = new Map<number, Map<string, [number, number]>>();
	const recordOf = (round: number, team: string) => {
		const table = recordAt.get(round) ?? before(round);
		recordAt.set(round, table);
		return table.get(team) ?? [0, 0];
	};
	for (const { fixture, winner, result: games } of played) {
		const [a] = fixture.teams;
		const series = records.get(fixture.id);
		roundOf(fixture).series.push({
			teams: fixture.teams,
			record: recordOf(fixture.round, a),
			winner,
			score:
				games.a === a ? [games.winsA, games.winsB] : [games.winsB, games.winsA],
			...(series && { series }),
		});
	}
	for (const fixture of pending)
		roundOf(fixture).series.push({
			teams: fixture.teams,
			record: recordOf(fixture.round, fixture.teams[0]),
		});
	const standing = swissStandings(teams, [played.map(result)], play);
	return {
		wins: play.wins,
		losses: play.losses,
		totalRounds: min(
			play.maxRounds ?? play.wins + play.losses - 1,
			play.wins + play.losses - 1,
		),
		rounds: [...rounds.values()].sort((x, y) => x.round - y.round),
		teams: standing.map(({ id, wins, losses, status }) => ({
			team: id,
			wins,
			losses,
			status,
		})),
	};
}
