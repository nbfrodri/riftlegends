import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, it } from "vitest";
import { attributeProfiles } from "./attributes.ts";
import { minPlayerGames } from "./season.ts";

type Game = RealSnapshot["games"][number];

let counter = 0;
function game(date: string, a: [string, number], b: [string, number]): Game {
	const id = `G${String(counter++).padStart(4, "0")}`;
	const line = (team: string, [player, cs]: [string, number]) => ({
		player,
		team,
		role: "mid" as const,
		cs,
		gold: 12000,
		kills: 3,
		deaths: 2,
		assists: 5,
		damageToChampions: 20000,
		visionScore: 30,
	});
	return {
		id,
		tournament: "T",
		date: `${date}T12:00:00Z`,
		teams: [
			{ id: "A", side: "blue", picks: [], bans: [] },
			{ id: "B", side: "red", picks: [], bans: [] },
		],
		winner: "A",
		lengthSeconds: 1800,
		draftOrder: false,
		lines: [line("A", a), line("B", b)],
	};
}

function build(currentGames: number, previous: boolean) {
	const peers: [string, string][] = [
		["Q1", "Q2"],
		["Q3", "Q4"],
		["Q5", "Q6"],
	];
	const games: Game[] = [];
	const before: Game[] = [];
	for (const [x, y] of peers)
		for (let i = 0; i < 40; i++) {
			games.push(game("2027-03-01", [x, 240], [y, 240]));
			before.push(game("2026-06-01", [x, 240], [y, 240]));
		}
	for (let i = 0; i < currentGames; i++)
		games.push(game("2027-03-01", ["P", 420], ["Q1", 240]));
	for (let i = 0; i < 40; i++)
		before.push(game("2026-06-01", ["P", 420], ["Q1", 240]));
	return {
		league: { id: "LCK", name: "LoL Champions Korea" },
		tournaments: [{ id: "T", name: "Season" }],
		seasonPlayers: ["P", ...peers.flat()].map((id) => ({ id })),
		games,
		...(previous ? { previousGames: before } : {}),
	} as unknown as RealSnapshot;
}

const farming = (snapshot: RealSnapshot) =>
	attributeProfiles(snapshot)("P", "mid").attributes.farming;

it("M1 a player with few games this season borrows last season's games", () => {
	expect(farming(build(2, true))).toBeGreaterThan(farming(build(2, false)));
});

it("M2 the more games this season, the less last season counts", () => {
	const alone = farming(build(2, false));
	const mixedFew = farming(build(2, true));
	const mixedMore = farming(build(15, true));
	const aloneMore = farming(build(15, false));
	expect(mixedFew - alone).toBeGreaterThanOrEqual(mixedMore - aloneMore);
});

it("M3 with the minimum of games this season, last season is ignored", () => {
	expect(farming(build(minPlayerGames, true))).toBe(
		farming(build(minPlayerGames, false)),
	);
});

it("M4 past games do not add departed players to the role cohort", () => {
	const snapshot = build(2, true);
	const withRetired = {
		...snapshot,
		previousGames: [
			...(snapshot.previousGames ?? []),
			...Array.from({ length: 30 }, () =>
				game("2026-05-01", ["Retired1", 900], ["Retired2", 900]),
			),
		],
	};
	expect(attributeProfiles(withRetired)("P", "mid")).toEqual(
		attributeProfiles(snapshot)("P", "mid"),
	);
});
