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

it("uses a kit advantage without any professional games", () => {
	const { matchups } = deriveChampionContent(
		[
			{ id: "Caitlyn", key: 51, classes: ["marksman"] },
			{ id: "Nilah", key: 895, classes: ["marksman"] },
		],
		[],
	);
	expect(matchups).toContainEqual({
		champion: "Caitlyn",
		against: "Nilah",
		role: "bot",
		value: 3,
		reasons: ["earlyVsScaling", "range"],
	});
});

it("blends team counters with cross-role samples without counting lane games twice", () => {
	const catalog = [
		{ id: "Zed", key: 238, classes: ["assassin"] },
		{ id: "KogMaw", key: 96, classes: ["marksman"] },
	];
	const results = (role: Role, games: number) =>
		deriveChampionContent(
			catalog,
			Array.from({ length: games }, (_, i) =>
				game(i, [["Zed", "mid"]], [["KogMaw", role]], "red"),
			),
		).counters.find(
			({ champion, against }) => champion === "Zed" && against === "KogMaw",
		);
	expect(results("bot", 0)).toMatchObject({
		value: 3,
		reasons: ["assassinVsCarry"],
	});
	expect(results("bot", 20)?.value).toBe(-2);
	expect(results("mid", 20)).toMatchObject({
		value: 3,
		reasons: ["assassinVsCarry"],
	});
});

it("does not recommend pairing two champions locked to the same role", () => {
	const catalog = [
		{ id: "Zed", key: 238, classes: ["assassin"] },
		{ id: "Veigar", key: 45, classes: ["mage"] },
	];
	const games = Array.from({ length: 30 }, (_, i) =>
		game(i, [["Zed", "mid"], ["Veigar"]], [], "blue"),
	);
	expect(deriveChampionContent(catalog, games).synergies).toEqual([]);
});

it("uses an explicitly curated role even when the professional sample is elsewhere", () => {
	const { champions } = deriveChampionContent(
		[{ id: "Galio", key: 3, classes: ["tank"] }],
		[game(1, [["Galio", "mid"]], [])],
	);
	expect(champions[0]?.positions.map(({ role }) => role)).toEqual([
		"mid",
		"support",
	]);
});

it("counts older presence with half the weight of the previous season", () => {
	const inYear = (year: number, picked: boolean) =>
		Array.from({ length: 60 }, (_, i) => ({
			...game(i, picked ? [["Annie", "mid"]] : [], []),
			date: `${year}-01-01T00:00:00Z`,
		}));
	const tier = (year: number) =>
		deriveChampionContent(catalog, [
			...inYear(2026, false),
			...inYear(2025, year === 2025),
			...inYear(2024, year === 2024),
		]).champions.find(({ id }) => id === "Annie")?.positions[0]?.tier;
	expect(tier(2025)).toBe("A");
	expect(tier(2024)).toBe("B");
});

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
	const { champions, counters, matchups, synergies } = deriveChampionContent(
		catalog,
		games,
		{ priorGames: 2 },
	);
	expect(matchups).toEqual([
		{
			champion: "Annie",
			against: "MonkeyKing",
			role: "mid",
			value: 7,
			reasons: ["range", "lockdownVsDash"],
		},
		{
			champion: "MonkeyKing",
			against: "Annie",
			role: "mid",
			value: -7,
			reasons: ["range", "lockdownVsDash"],
		},
	]);
	expect(synergies).toEqual([
		{
			a: "Annie",
			b: "MonkeyKing",
			value: 5,
			reasons: ["wombo", "chainCc", "damageMix"],
		},
		{ a: "Annie", b: "TestChampion", value: 4, reasons: ["damageMix"] },
		{ a: "MonkeyKing", b: "TestChampion", value: 2 },
	]);
	expect(
		aiContent.safeParse({
			champions: champions.map(
				({ cc: _cc, mobility: _mobility, frontline: _frontline, ...draft }) =>
					draft,
			),
			matchups,
			counters,
			synergies,
			players: [],
			identities: [],
		}).success,
	).toBe(true);
	expect(
		JSON.stringify(
			deriveChampionContent([...catalog].reverse(), [...games].reverse(), {
				priorGames: 2,
			}),
		),
	).toBe(
		JSON.stringify(deriveChampionContent(catalog, games, { priorGames: 2 })),
	);
});
