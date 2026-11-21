import {
	GAP_RATING,
	type MatchView,
	ROLES,
	type Role,
	type SeriesSummary,
} from "@rift-legends/contracts";

type Fact = MatchView["facts"][number];
type Ended = Extract<Fact, { type: "match.ended" }>;
type Event = Extract<Fact, { type: "match.event" }>;

/** One player's line of a game, with the side and role the core's order implies. */
type PlayerLine = Ended["players"][number] & {
	side: "blue" | "red";
	role: Role;
};

/** A game read from `match.view`: nothing here is computed from the simulation. */
export interface GameResult {
	game: number;
	blue: string;
	red: string;
	winner: string;
	/** In seconds. */
	duration: number;
	lines: PlayerLine[];
	kills: { blue: number; red: number };
	disputes: Event[];
}

/** `match.ended` lists blue's five in role order, then red's. */
export function readGame(view: MatchView): GameResult | null {
	const started = view.facts.find((f) => f.type === "match.started");
	const ended = view.facts.find((f) => f.type === "match.ended");
	if (started?.type !== "match.started" || ended?.type !== "match.ended") {
		return null;
	}
	const lines = ended.players.map((player, i) => ({
		...player,
		side: i < ROLES.length ? ("blue" as const) : ("red" as const),
		role: ROLES[i % ROLES.length] as Role,
	}));
	const events = view.facts.filter((f) => f.type === "match.event");
	const killsOf = (side: "blue" | "red") =>
		lines.filter((l) => l.side === side).reduce((n, l) => n + l.kills, 0);
	return {
		game: view.game,
		blue: started.blue,
		red: started.red,
		winner: ended.winner,
		duration: ended.duration,
		lines,
		kills: { blue: killsOf("blue"), red: killsOf("red") },
		disputes: ended.decisive.flatMap(({ event }) => {
			const found = events[event];
			return found ? [found] : [];
		}),
	};
}

/** Seconds as `m:ss`. */
export const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Per 10,000, as a whole percentage. */
export const percent = (share: number) => Math.round(share / 100);

/** The positive causes of an event, the biggest first, as the core named them. */
export const topCauses = (event: Event, count = 3) =>
	event.causes
		.filter((cause) => cause.points > 0)
		.sort((a, b) => b.points - a.points)
		.slice(0, count)
		.map((cause) => cause.key);

/** One role of a comparison: who leads and by how much, as plain numbers. */
export interface RoleGap {
	role: Role;
	/** The team ahead on rating; null if tied. */
	team: string | null;
	/** Rating points the leader has; never negative. */
	points: number;
	/** Gold the leader has over the other; negative if the other team has more. */
	gold: number;
	/** The rating difference passes the threshold. */
	gap: boolean;
}

/** The gaps of one game, as the core summarised them. */
export function gapsOfGame(
	game: GameResult,
	summary: SeriesSummary | undefined,
): RoleGap[] {
	const lines = summary?.lanes.find((l) => l.game === game.game)?.lines ?? [];
	return lines.map((line) => {
		const lead = line.favored === "red" ? -1 : 1;
		return {
			role: line.role,
			team: line.favored === null ? null : game[line.favored],
			points: Math.abs(line.rating),
			gold: line.gold * lead,
			gap: line.gap,
		};
	});
}

/**
 * The mean gaps of all the games, per role, between the two teams. Sides swap
 * between games, so each game is read from the team's point of view.
 */
export function gapsOfSeries(
	games: readonly GameResult[],
	summary: SeriesSummary | undefined,
): RoleGap[] {
	const first = games[0];
	if (!first || !summary) return [];
	const teamA = first.blue;
	const teamB = first.red;
	return ROLES.map((role) => {
		let rating = 0;
		let gold = 0;
		for (const game of games) {
			const line = summary.lanes
				.find((l) => l.game === game.game)
				?.lines.find((l) => l.role === role);
			if (!line) continue;
			const sign = game.blue === teamA ? 1 : -1;
			rating += line.rating * sign;
			gold += line.gold * sign;
		}
		const meanRating = rating / games.length;
		const meanGold = Math.round(gold / games.length);
		const lead = meanRating < 0 ? -1 : 1;
		return {
			role,
			team: meanRating === 0 ? null : meanRating > 0 ? teamA : teamB,
			points: Math.round(Math.abs(meanRating) * 10) / 10,
			gold: meanGold * lead,
			gap: Math.abs(meanRating) > GAP_RATING,
		};
	});
}
