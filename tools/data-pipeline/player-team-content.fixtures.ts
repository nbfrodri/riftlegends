import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { buildPlayerTeamContent } from "./player-team-content.ts";

export type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
const date = "2026-09-01T00:00:00.000Z";
export const logo = {
	file: "Alpha.png",
	url: "https://example.com/alpha.png",
	sha1: "a".repeat(40),
	mime: "image/png",
};

export function game(index: number, lines: Line[], winner = "Alpha"): Game {
	return {
		id: String(index),
		tournament: "finals",
		date,
		lengthSeconds: 1800,
		draftOrder: true,
		teams: [
			{
				id: "Alpha",
				side: "blue",
				picks: ["Draven", "Elise", "Renekton"],
				bans: [],
			},
			{ id: "Beta", side: "red", picks: ["Ornn"], bans: [] },
		],
		lines,
		winner,
	};
}

export function line(player: string, fields: Partial<Line> = {}): Line {
	return {
		player,
		team: "Alpha",
		role: "bot",
		champion: "Draven",
		cs: 220,
		kills: 4,
		deaths: 2,
		assists: 4,
		damageToChampions: 19000,
		visionScore: 20,
		gold: 11000,
		...fields,
	};
}

export function snapshot(games: Game[], league = "LCK"): RealSnapshot {
	return {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: date,
			licence: "CC BY-SA 3.0",
			attribution: "Leaguepedia contributors",
			dataDragonVersion: "16.23.1",
			queries: [{ url: "https://lol.fandom.com/api.php", retrievedAt: date }],
		},
		league: { id: league, name: league },
		tournaments: [{ id: "finals", name: "Finals", startsOn: "2026-08-31" }],
		teams: [
			{ id: "Alpha", name: "Alpha Esports", short: "AE", logo, league },
			{ id: "Beta", name: "Beta Esports", short: "BE", league },
		],
		rosters: [
			{
				tournament: "finals",
				team: "Alpha",
				players: [],
				coaches: [
					{ id: "assistant", name: "Assistant", role: "Assistant Coach" },
					{ id: "head", name: "Head", role: "Head Coach" },
				],
			},
		],
		seasonPlayers: ["Starter", "Brief", "Reserve"].map((id) => ({
			id,
			name: id,
			team: "Alpha",
			role: "bot",
			sub: id !== "Starter",
			...(id === "Reserve" ? { noGames: true } : {}),
		})),
		games,
	};
}

export function profile(source: RealSnapshot, id: string) {
	const player = buildPlayerTeamContent([source]).players.find(
		(p) => p.id === id,
	);
	if (!player) throw new Error(`Missing profile: ${id}`);
	return player;
}
