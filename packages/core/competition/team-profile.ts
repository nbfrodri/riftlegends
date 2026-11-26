import { ROLES } from "@rift-legends/contracts";
import { QueryRejection } from "../server/dispatcher";
import type { SeasonSession } from "./handlers";
import type { SeriesRecord } from "./season-records";

const TOP = 5;

/** The `team.profile` query (plan 31, Q5), aggregated from the recorded series. */
export function teamProfile(state: SeasonSession, { team }: { team: string }) {
	const season = state.season;
	const info = season?.content.match.teams.find(({ id }) => id === team);
	if (!season || !info)
		return new QueryRejection({ code: "unknown-team", params: { team } });
	const roster = season.content.content.players
		.filter((player) => player.team === team)
		.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
	const records = [...season.records.values()]
		.filter(({ teams }) => teams.includes(team))
		.reverse();
	const series = records.map((record) => entryOf(record, team));
	let length = 0;
	while (length < series.length && series[length]?.won === series[0]?.won)
		length++;
	const games = records.flatMap(({ games }) => games);
	const lines = games.flatMap(({ lines }) =>
		lines.filter((line) => line.team === team),
	);
	const players = new Map<
		string,
		{
			player: string;
			games: number;
			kills: number;
			deaths: number;
			assists: number;
		}
	>();
	const champions = new Map<string, number>();
	for (const line of lines) {
		const row = players.get(line.player) ?? {
			player: line.player,
			games: 0,
			kills: 0,
			deaths: 0,
			assists: 0,
		};
		row.games += 1;
		row.kills += line.kills;
		row.deaths += line.deaths;
		row.assists += line.assists;
		players.set(line.player, row);
		champions.set(line.champion, (champions.get(line.champion) ?? 0) + 1);
	}
	const gamesWon = series.reduce((sum, { score }) => sum + score[0], 0);
	const gamesLost = series.reduce((sum, { score }) => sum + score[1], 0);
	const seconds = games.reduce((sum, { duration }) => sum + duration, 0);
	return {
		team: {
			id: info.id,
			name: info.name,
			...(info.short && { short: info.short }),
			...(info.league && { league: info.league }),
			seed: info.seed,
		},
		players: roster.map(({ id, handle, role, level, nationality, sub }) => ({
			id,
			handle,
			role,
			level,
			...(nationality && { nationality }),
			sub: sub ?? false,
		})),
		recent: series.slice(0, TOP),
		series,
		streak: length ? { result: series[0]?.won ? "won" : "lost", length } : null,
		stats: {
			seriesWon: series.filter(({ won }) => won).length,
			seriesLost: series.filter(({ won }) => !won).length,
			gamesWon,
			gamesLost,
			averageDuration: games.length
				? (seconds - (seconds % games.length)) / games.length
				: null,
			players: [...players.values()],
			champions: [...champions]
				.map(([champion, count]) => ({ champion, games: count }))
				.sort(
					(a, b) => b.games - a.games || a.champion.localeCompare(b.champion),
				)
				.slice(0, TOP),
		},
	};
}

function entryOf(record: SeriesRecord, team: string) {
	const own = record.teams.indexOf(team) as 0 | 1;
	const other = own === 0 ? 1 : 0;
	return {
		series: record.id,
		competition: record.competition,
		stage: record.stage,
		day: record.day,
		opponent: record.teams[other],
		score: [record.score[own], record.score[other]] as [number, number],
		won: record.winner === team,
	};
}
