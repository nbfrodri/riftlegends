import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { FixtureEvidence } from "./league-format-definitions.ts";

export interface LeagueSeries {
	id: string;
	page: string;
	tab: string;
	number: number;
	day: number;
	teams: readonly [string, string];
	bestOf: number;
}

export const seasonDay = (date: string) =>
	Math.floor((Date.parse(date) - Date.UTC(2026, 0, 1)) / 86_400_000);

export function leagueSeries(snapshot: RealSnapshot): LeagueSeries[] {
	const matches = new Map<string, RealSnapshot["games"]>();
	for (const game of snapshot.games) {
		const id = game.id.replace(/_\d+$/, "");
		const games = matches.get(id) ?? [];
		games.push(game);
		matches.set(id, games);
	}
	return [...matches]
		.map(([id, games]) => {
			const first = games[0];
			if (!first) throw new Error(`No games for ${id}`);
			const suffix = id
				.slice(first.tournament.length + 1)
				.match(/^(.+)_(\d+)$/);
			if (!suffix?.[1] || !id.startsWith(`${first.tournament}_`))
				throw new Error(`Unexpected Leaguepedia id: ${id}`);
			const teams = [first.teams[0].id, first.teams[1].id] as const;
			const wins = new Map(teams.map((team) => [team, 0]));
			for (const game of games) {
				if (game.teams.some(({ id }) => !wins.has(id)))
					throw new Error(`Teams changed within ${id}`);
				if (game.winner)
					wins.set(game.winner, (wins.get(game.winner) ?? 0) + 1);
			}
			return {
				id,
				page: first.tournament.split("/").at(-1) ?? first.tournament,
				tab: suffix[1],
				number: Number(suffix[2]),
				teams,
				day: Math.min(...games.map(({ date }) => seasonDay(date))),
				bestOf: 2 * Math.max(...wins.values()) - 1,
			};
		})
		.sort((a, b) => a.day - b.day || a.number - b.number);
}

export function selectSeries(
	series: LeagueSeries[],
	{ page, tabs, match, anchor }: FixtureEvidence,
) {
	const selected = series.filter(
		(row) =>
			row.page === page &&
			tabs.test(row.tab) &&
			(match === undefined || row.number === match),
	);
	if (!anchor) return selected;
	// A group or lane is a connected component of the teams that actually met.
	const teams = new Set([anchor]);
	let previous = 0;
	while (teams.size !== previous) {
		previous = teams.size;
		for (const row of selected)
			if (row.teams.some((team) => teams.has(team))) {
				for (const team of row.teams) teams.add(team);
			}
	}
	return selected.filter((row) => row.teams.every((team) => teams.has(team)));
}
