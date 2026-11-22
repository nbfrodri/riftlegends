import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import { buildPlayerTeamContent } from "./player-team-content.ts";

type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
const date = "2026-09-01T00:00:00.000Z";
const logo = {
	file: "Alpha.png",
	url: "https://example.com/alpha.png",
	sha1: "a".repeat(40),
	mime: "image/png",
};

function game(index: number, lines: Line[], winner = "Alpha"): Game {
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

function line(player: string, fields: Partial<Line> = {}): Line {
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

function snapshot(games: Game[], league = "LCK"): RealSnapshot {
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

function profile(source: RealSnapshot, id: string) {
	const player = buildPlayerTeamContent([source]).players.find(
		(p) => p.id === id,
	);
	if (!player) throw new Error(`Missing profile: ${id}`);
	return player;
}

const season = () =>
	Array.from({ length: 24 }, (_, i) =>
		game(i, [
			line("Starter", {
				cs: 340,
				visionScore: 30,
				champion: i < 16 ? "Draven" : "Jinx",
			}),
			...(i === 0
				? [
						line("Brief", {
							team: "Beta",
							cs: 50,
							visionScore: 5,
							champion: "Kaisa",
						}),
					]
				: []),
			line("Top", { role: "top", cs: 500, champion: "Renekton" }),
		]),
	);

test("J1 and P4 rank by role, shrink small samples and flag estimates", () => {
	const source = snapshot(season());
	const starter = profile(source, "Starter");
	const brief = profile(source, "Brief");
	const reserve = profile(source, "Reserve");
	expect(Object.keys(starter.attributes)).toHaveLength(20);
	expect(reserve.estimated).toEqual(Object.keys(reserve.attributes));
	expect(starter.estimated).toContain("communication");
	expect(starter.estimated).not.toContain("farming");
	expect(starter.attributes.farming).toBeGreaterThan(
		reserve.attributes.farming,
	);
	expect(reserve.attributes.farming).toBeGreaterThan(brief.attributes.farming);
	expect(reserve.attributes.farming - brief.attributes.farming).toBeLessThan(
		starter.attributes.farming - reserve.attributes.farming,
	);
	expect(
		profile(
			snapshot(
				season().map((g) => ({
					...g,
					lines: g.lines.filter((l) => l.role !== "top"),
				})),
			),
			"Starter",
		).attributes.farming,
	).toBe(starter.attributes.farming);
});

test("J2 gives the same performance more weight in LCK and LPL than CBLOL", () => {
	const fromLeague = (league: string) =>
		profile(snapshot(season(), league), "Starter").level;
	expect(fromLeague("LCK")).toBeGreaterThanOrEqual(fromLeague("LPL"));
	expect(fromLeague("LPL")).toBeGreaterThan(fromLeague("LCS"));
	expect(fromLeague("LCS")).toBeGreaterThan(fromLeague("CBLOL"));
});

test("J3 keeps played champions ahead of role fillers and uses exposure for mastery", () => {
	const source = snapshot(season());
	const player = profile(source, "Starter");
	expect(player.mains).toEqual(["Draven", "Jinx"]);
	expect(player.weak).toEqual(["Kaisa"]);
	const mastery = new Map(
		player.mastery.map(({ champion, value }) => [champion, value]),
	);
	expect(mastery.get("Draven")).toBeGreaterThan(mastery.get("Jinx") ?? 100);
	expect(mastery.get("Jinx")).toBeGreaterThan(mastery.get("Kaisa") ?? 100);
});

test("J4 uses game results, chooses the head coach, copies logo and fills vacant roles", () => {
	const content = buildPlayerTeamContent([
		snapshot([game(1, [line("Starter")], "Beta")]),
	]);
	expect(content.teams).toMatchObject([
		{ id: "Beta", seed: 1, coach: { name: "—", personality: "balanced" } },
		{
			id: "Alpha",
			name: "Alpha Esports",
			short: "AE",
			logo,
			seed: 2,
			coach: { name: "Head", personality: "balanced" },
		},
	]);
	expect(
		content.players
			.filter((p) => p.team === "Beta")
			.map((p) => p.role)
			.sort(),
	).toEqual(["bot", "jungle", "mid", "support", "top"]);
	expect(
		content.players.find((p) => p.team === "Beta")?.estimated,
	).toHaveLength(20);
	expect(
		content.players.filter((p) => p.team === "Alpha" && p.role === "bot").at(-1)
			?.id,
	).toBe("Starter");
});

test("J5 uses the early picks and the curve of the draft, with a minimum sample", () => {
	const source = snapshot(season().slice(0, 8));
	expect(
		buildPlayerTeamContent([source]).teams.find((t) => t.id === "Alpha")?.coach
			.personality,
	).toBe("early");
	const unordered = {
		...source,
		games: source.games.map((g) => ({ ...g, draftOrder: false })),
	};
	expect(
		buildPlayerTeamContent([unordered]).teams.find((t) => t.id === "Alpha")
			?.coach.personality,
	).toBe("balanced");
});

test("input row order does not change the serialized output", () => {
	const source = snapshot(season());
	expect(JSON.stringify(buildPlayerTeamContent([source]))).toBe(
		JSON.stringify(
			buildPlayerTeamContent([
				{
					...source,
					teams: [...source.teams].reverse(),
					seasonPlayers: [...source.seasonPlayers].reverse(),
					games: [...source.games]
						.reverse()
						.map((g) => ({ ...g, lines: [...g.lines].reverse() })),
				},
			]),
		),
	);
});
