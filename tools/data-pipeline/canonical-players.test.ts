import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import { mergeSamePlayers } from "./canonical-players.ts";

type Snapshot = Pick<RealSnapshot, "rosters" | "seasonPlayers" | "games">;
const line = (player: string, team = "Alpha") =>
	({
		player,
		team,
		kills: 1,
		deaths: 1,
		assists: 1,
		cs: 1,
		gold: 1,
		damageToChampions: 1,
		visionScore: 1,
	}) as Snapshot["games"][number]["lines"][number];
const game = (id: string, lines: ReturnType<typeof line>[]) =>
	({ id, lines }) as Snapshot["games"][number];

function build(): Snapshot {
	return {
		games: [
			game("1", [line("Xyno"), line("xyno")]),
			game("2", [line("Xyno"), line("Other", "Beta")]),
		],
		rosters: [
			{
				tournament: "t",
				team: "Alpha",
				players: [
					{ id: "Xyno", name: "Xyno", role: "top", sub: false },
					{ id: "xyno", name: "xyno", sub: true, noGames: true },
				],
				coaches: [
					{ id: "Boss", name: "Boss", role: "Head Coach" },
					{ id: "boss", name: "boss", role: "Head Coach" },
				],
			},
		],
		seasonPlayers: [
			{ id: "Xyno", name: "Xyno", role: "top", sub: false, team: "Alpha" },
			{ id: "xyno", name: "xyno", sub: true, noGames: true, team: "Alpha" },
			{ id: "Other", name: "Other", sub: false, team: "Beta" },
		],
	};
}

test("ids that differ only in case on the same team become one player", () => {
	const [merged] = mergeSamePlayers([build()]);
	expect(merged?.games.flatMap((g) => g.lines.map((l) => l.player))).toEqual([
		"Xyno",
		"Xyno",
		"Xyno",
		"Other",
	]);
	expect(merged?.rosters[0]?.players).toEqual([
		{ id: "Xyno", name: "Xyno", role: "top", sub: false },
	]);
	expect(merged?.rosters[0]?.coaches).toEqual([
		{ id: "Boss", name: "Boss", role: "Head Coach" },
	]);
	expect(merged?.seasonPlayers.map((p) => p.id)).toEqual(["Other", "Xyno"]);
});

test("the variant with the most games wins, ties go to the lexicographic order", () => {
	const tie = build();
	tie.games = [game("1", [line("xyno"), line("Xyno")])];
	const [merged] = mergeSamePlayers([tie]);
	expect(merged?.seasonPlayers.map((p) => p.id)).toEqual(["Other", "Xyno"]);
	const many = build();
	many.games = [game("1", [line("xyno")]), game("2", [line("xyno")])];
	expect(mergeSamePlayers([many])[0]?.seasonPlayers.map((p) => p.id)).toContain(
		"xyno",
	);
});

test("hashed disambiguators of the same handle and team merge too", () => {
	const snapshot = build();
	snapshot.games = [game("1", [line("Ahn~aa"), line("Ahn~bb")])];
	snapshot.rosters = [];
	snapshot.seasonPlayers = [
		{ id: "Ahn~aa", name: "Ahn", sub: false, team: "Alpha" },
		{ id: "Ahn", name: "Ahn", sub: true, noGames: true, team: "Alpha" },
	];
	const [merged] = mergeSamePlayers([snapshot]);
	expect(merged?.seasonPlayers).toEqual([
		{ id: "Ahn~aa", name: "Ahn", sub: false, team: "Alpha" },
	]);
});

test("look-alike characters (I for l, 0 for o) on the same team merge", () => {
	const snapshot = build();
	snapshot.games = [game("1", [line("BrokenBlade"), line("BrokenBlade")])];
	snapshot.rosters = [];
	snapshot.seasonPlayers = [
		{
			id: "BrokenBlade",
			name: "BrokenBlade",
			role: "top",
			sub: false,
			team: "Alpha",
		},
		{
			id: "BrokenBIade",
			name: "BrokenBIade",
			sub: true,
			noGames: true,
			team: "Alpha",
		},
		{ id: "Z0ro", name: "Z0ro", sub: false, team: "Alpha" },
		{ id: "Zoro", name: "Zoro", sub: false, noGames: true, team: "Alpha" },
	];
	const [merged] = mergeSamePlayers([snapshot]);
	expect(merged?.seasonPlayers.map((p) => p.id)).toEqual([
		"BrokenBlade",
		"Z0ro",
	]);
});

test("look-alike handles on different teams stay separate", () => {
	const snapshot = build();
	snapshot.seasonPlayers.push({
		id: "XyIo",
		name: "XyIo",
		sub: false,
		team: "Beta",
	});
	snapshot.seasonPlayers.push({
		id: "Xylo",
		name: "Xylo",
		sub: false,
		team: "Alpha",
	});
	const [merged] = mergeSamePlayers([snapshot]);
	expect(merged?.seasonPlayers.map((p) => p.id)).toContain("XyIo");
	expect(merged?.seasonPlayers.map((p) => p.id)).toContain("Xylo");
});

test("the same handle on different teams stays as separate players", () => {
	const snapshot = build();
	snapshot.seasonPlayers.push({
		id: "XYNO",
		name: "XYNO",
		sub: false,
		team: "Beta",
	});
	snapshot.games.push(game("3", [line("XYNO", "Beta")]));
	const [merged] = mergeSamePlayers([snapshot]);
	expect(merged?.seasonPlayers.map((p) => p.id).sort()).toEqual([
		"Other",
		"XYNO",
		"Xyno",
	]);
});

test("the committed snapshot has no duplicated players left", () => {
	const dir = new URL("../../packages/core/content/real/", import.meta.url);
	const snapshots = ["lck", "lpl", "lec", "lcp", "lcs", "cblol"].map((id) =>
		JSON.parse(readFileSync(fileURLToPath(new URL(`${id}.json`, dir)), "utf8")),
	);
	expect(mergeSamePlayers(snapshots)).toEqual(snapshots);
});

test("no player is duplicated anywhere in the committed content", () => {
	const dir = new URL("../../packages/core/content/real/", import.meta.url);
	const read = (file: string) =>
		JSON.parse(readFileSync(fileURLToPath(new URL(file, dir)), "utf8"));
	const normalized = (id: string) =>
		(id.split("~")[0] ?? id)
			.replace(/I/g, "l")
			.toLowerCase()
			.replace(/0/g, "o")
			.replace(/[^a-z0-9]/g, "");
	const clashes: string[] = [];
	const unique = (
		kind: string,
		values: string[],
		label: (v: string) => string,
	) => {
		const seen = new Map<string, string>();
		for (const value of values) {
			const key = label(value);
			const other = seen.get(key);
			if (other !== undefined) clashes.push(`${kind}: ${other} / ${value}`);
			else seen.set(key, value);
		}
	};
	const players = read("players.json") as { id: string }[];
	unique(
		"id",
		players.map((p) => p.id),
		(id) => id,
	);
	unique(
		"handle",
		players.map((p) => p.id),
		normalized,
	);
	const photos = (
		read("photos.json") as { photos: { player: string; url: string }[] }
	).photos;
	unique(
		"photo",
		photos.map((p) => p.url),
		(url) => url,
	);
	for (const league of ["lck", "lpl", "lec", "lcp", "lcs", "cblol"]) {
		const snapshot = read(`${league}.json`) as Snapshot;
		unique(
			"season id",
			snapshot.seasonPlayers.map((p) => p.id),
			(id) => id,
		);
	}
	expect(clashes).toEqual([]);
});

test("a redirect alias merges two ids whose handles differ", () => {
	// Leaguepedia redirects `Van (Kim Seung-hoo)` to `Van1`: one person.
	const alias = "Van~413d6f18ab7937e2";
	const source: Snapshot = {
		games: [
			game("1", [line("Van1"), line("Other", "Beta")]),
			game("2", [line("Van1")]),
			game("3", [line(alias)]),
		],
		rosters: [
			{
				tournament: "t",
				team: "Alpha",
				players: [
					{ id: "Van1", name: "Van1", role: "jungle", sub: false },
					{ id: alias, name: "Van", role: "jungle", sub: true },
				],
				coaches: [],
			},
		],
		seasonPlayers: [
			{ id: "Van1", name: "Van1", role: "jungle", sub: false, team: "Alpha" },
			{ id: alias, name: "Van", role: "jungle", sub: true, team: "Alpha" },
		],
	};
	const [plain] = mergeSamePlayers([source]);
	expect(plain?.seasonPlayers.map((p) => p.id)).toEqual(["Van1", alias]);
	const [merged] = mergeSamePlayers([source], new Map([[alias, "Van1"]]));
	expect(merged?.seasonPlayers.map((p) => p.id)).toEqual(["Van1"]);
	expect(merged?.games.flatMap((g) => g.lines.map((l) => l.player))).toEqual([
		"Van1",
		"Other",
		"Van1",
		"Van1",
	]);
});
