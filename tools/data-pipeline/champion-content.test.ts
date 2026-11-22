import { aiContent } from "@rift-legends/contracts";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, it } from "vitest";
import { deriveChampionContent } from "./champion-content.ts";

type Game = RealSnapshot["games"][number];
type Role = NonNullable<Game["lines"][number]["role"]>;
type Pick = [champion: string, role?: Role | undefined];

function game(
	id: number,
	blue: Pick[],
	red: Pick[],
	winner?: "blue" | "red",
	bans: (string | null)[] = [],
): Game {
	return {
		id: String(id),
		date: "2026-01-01T00:00:00Z",
		tournament: "Test",
		draftOrder: false,
		winner,
		teams: [
			{ id: "blue", side: "blue", picks: blue.map(([id]) => id), bans },
			{ id: "red", side: "red", picks: red.map(([id]) => id), bans: [] },
		],
		lines: (
			[
				["blue", blue],
				["red", red],
			] as const
		).flatMap(([team, picks]) =>
			picks.map(([champion, role]) => ({
				player: team + champion,
				team,
				champion,
				role,
			})),
		),
	};
}

const catalog = [
	{ id: "MonkeyKing", key: 62, classes: ["fighter", "tank"] },
	{ id: "Annie", key: 1, classes: ["mage"] },
	{ id: "TestChampion", key: 999, classes: ["marksman"] },
];

it("R1/R5 keeps unplayed champions and records class-based estimates", () => {
	const { champions, estimated } = deriveChampionContent(catalog, []);
	expect(champions).toEqual([
		expect.objectContaining({
			id: "Annie",
			name: "Annie",
			positions: [{ role: "mid", tier: "C" }],
		}),
		expect.objectContaining({
			id: "MonkeyKing",
			positions: [{ role: "jungle", tier: "C" }],
		}),
		expect.objectContaining({
			id: "TestChampion",
			name: "TestChampion",
			positions: [{ role: "bot", tier: "C" }],
			damage: "physical",
			power: "late",
			archetypes: ["carry"],
			cc: 2,
			mobility: 4,
			frontline: 2,
		}),
	]);
	expect(estimated).toContain("TestChampion");
	expect(estimated).not.toContain("MonkeyKing");
});

it("R2 includes exactly 5% of picks, counts roleless picks and weights unlabelled bans", () => {
	const games = Array.from({ length: 100 }, (_, i) =>
		game(
			i,
			i < 20
				? [["Annie", i === 0 ? "support" : i === 1 ? undefined : "mid"]]
				: [],
			i < 21 ? [["MonkeyKing", i === 0 ? "top" : "jungle"]] : [],
			undefined,
			i >= 21 && i < 43 ? ["Annie", "Annie", null] : [],
		),
	);
	const { champions } = deriveChampionContent(catalog, games);
	expect(champions.find(({ id }) => id === "Annie")?.positions).toEqual([
		{ role: "mid", tier: "A" },
		{ role: "support", tier: "C" },
	]);
	expect(champions.find(({ id }) => id === "MonkeyKing")?.positions).toEqual([
		{ role: "jungle", tier: "B" },
	]);
});

it("R3 counts only same-role opponents and allied pairs in games with a winner", () => {
	const games = [
		game(
			1,
			[
				["Annie", "mid"],
				["TestChampion", "bot"],
			],
			[["MonkeyKing", "mid"]],
			"blue",
		),
		game(
			2,
			[["MonkeyKing", "mid"]],
			[
				["TestChampion", "bot"],
				["Annie", "mid"],
			],
			"red",
		),
		game(
			3,
			[
				["Annie", "mid"],
				["TestChampion", "bot"],
			],
			[["MonkeyKing", "mid"]],
		),
		game(
			4,
			[["Annie", "support"]],
			[
				["MonkeyKing", "mid"],
				["TestChampion", "bot"],
			],
			"red",
		),
	];
	const { champions, matchups, synergies } = deriveChampionContent(
		catalog,
		games,
		2,
	);
	expect(matchups).toEqual([
		{ champion: "Annie", against: "MonkeyKing", role: "mid", value: 10 },
		{ champion: "MonkeyKing", against: "Annie", role: "mid", value: -10 },
	]);
	expect(synergies).toEqual([{ a: "Annie", b: "TestChampion", value: 6 }]);
	expect(deriveChampionContent(catalog, games, 3).matchups).toEqual([]);
	expect(deriveChampionContent(catalog, games, 3).synergies).toEqual([]);
	expect(
		aiContent.safeParse({
			champions: champions.map(
				({ cc: _cc, mobility: _mobility, frontline: _frontline, ...draft }) =>
					draft,
			),
			matchups,
			synergies,
			players: [],
			identities: [],
		}).success,
	).toBe(true);
	expect(
		JSON.stringify(
			deriveChampionContent([...catalog].reverse(), [...games].reverse(), 2),
		),
	).toBe(JSON.stringify(deriveChampionContent(catalog, games, 2)));
});
