import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { bin, stringtableUrl } from "./champion-kit-source.ts";
import { catalogUrl, championFiles, readCatalog } from "./champions.ts";
import { Client } from "./client.ts";

const fixture = (name: string): unknown =>
	JSON.parse(
		readFileSync(
			new URL(`./fixtures/communitydragon/${name}`, import.meta.url),
			"utf8",
		),
	);
// Annie and Wukong borrow the kit files of Soraka and Yasuo.
const kitFiles = new Map([
	[bin("16.23", "Annie"), "soraka.bin.json"],
	[bin("16.23", "MonkeyKing"), "yasuo.bin.json"],
	[stringtableUrl("16.23"), "stringtable.json"],
]);

const summary = [
	{ id: -1, alias: "None", name: "None", roles: [] },
	{
		id: 62,
		alias: "MonkeyKing",
		name: "x",
		description: "y",
		roles: ["fighter", "tank"],
	},
	{ id: 1, alias: "Annie", name: "x", description: "y", roles: ["mage"] },
	{ id: 60001, alias: "Jade_Annie", name: "x", roles: ["mage"] },
	{ id: 3000, alias: "NoClass", name: "x", roles: [] },
];

function league(id: string, winner: string) {
	return {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			licence: "CC BY-SA 3.0",
			attribution: "A",
			retrievedAt:
				id === "LCK" ? "2026-11-20T00:00:00Z" : "2026-11-21T00:00:00Z",
			dataDragonVersion: "16.23.1",
			queries: [
				{
					url: "https://lol.fandom.com/api.php",
					retrievedAt: "2026-11-20T00:00:00Z",
				},
			],
		},
		league: { id, name: id },
		tournaments: [{ id: "T", name: "T" }],
		teams: [
			{ id: "a", name: "A", league: id },
			{ id: "b", name: "B", league: id },
		],
		rosters: [],
		seasonPlayers: [],
		games: [
			{
				id: id,
				tournament: "T",
				date: "2026-01-01T00:00:00Z",
				draftOrder: true,
				winner,
				teams: [
					{ id: "a", side: "blue", picks: ["Annie"], bans: ["MonkeyKing"] },
					{ id: "b", side: "red", picks: ["MonkeyKing"], bans: [] },
				],
				lines: [
					{ player: "p", team: "a", champion: "Annie", role: "mid" },
					{ player: "q", team: "b", champion: "MonkeyKing", role: "mid" },
				],
			},
		],
	};
}

it("R5 keeps only playable champions and drops names and titles", () => {
	expect(readCatalog(summary)).toEqual([
		{ id: "Annie", key: 1, classes: ["mage"] },
		{ id: "MonkeyKing", key: 62, classes: ["fighter", "tank"] },
	]);
	expect(() => readCatalog({})).toThrow();
});

it("R1-R3 writes reproducible files from the cache and the snapshot", async () => {
	const dir = await mkdtemp(join(tmpdir(), "champions-"));
	const snapshotDir = join(dir, "snapshot");
	const outputDir = join(dir, "out");
	await mkdir(snapshotDir);
	await writeFile(
		join(snapshotDir, "lck.json"),
		JSON.stringify(league("LCK", "a")),
	);
	await writeFile(
		join(snapshotDir, "lpl.json"),
		JSON.stringify(league("LPL", "b")),
	);
	await writeFile(join(snapshotDir, "history.json"), "{}");
	let requests = 0;
	const options = {
		cacheDir: join(dir, "cache"),
		snapshotDir,
		outputDir,
		priorGames: 2,
		now: () => Date.UTC(2026, 10, 22),
		fetch: async (url: string | URL | Request) => {
			requests++;
			if (String(url) === catalogUrl) return Response.json(summary);
			const kitFile = kitFiles.get(String(url));
			if (kitFile) return Response.json(fixture(kitFile));
			const query = new URL(String(url)).searchParams;
			const historicalPicks = query
				.get("tables")
				?.startsWith("ScoreboardPlayers");
			const year = query.get("where")?.includes("2025") ? 2025 : 2024;
			const rows = historicalPicks
				? [
						{
							Champion: "Wukong",
							Role: "jungle",
							Games: year === 2025 ? "40" : "0",
						},
					]
				: [{ Games: "100" }];
			return Response.json({ cargoquery: rows.map((title) => ({ title })) });
		},
		sleep: async () => {},
	};
	await new Client(options).get(catalogUrl, readCatalog);
	const offlineWithoutHistory = await championFiles({
		...options,
		offline: true,
	});
	expect(offlineWithoutHistory.missingSeasons).toEqual([2025, 2024]);
	expect(requests).toBe(1);
	await championFiles(options);
	const first = await Promise.all(
		["champions", "matchups", "synergies", "provenance", "counters"].map(
			(name) => readFile(join(outputDir, `${name}.json`), "utf8"),
		),
	);
	await championFiles({ ...options, offline: true });
	const second = await Promise.all(
		["champions", "matchups", "synergies", "provenance", "counters"].map(
			(name) => readFile(join(outputDir, `${name}.json`), "utf8"),
		),
	);
	expect(second).toEqual(first);
	// catalog, 3 history queries, then the string table and one file per champion
	expect(requests).toBe(8);
	expect(JSON.parse(first[1] ?? "")).toEqual([
		{
			champion: "Annie",
			against: "MonkeyKing",
			role: "mid",
			value: 1,
			reasons: ["range"],
		},
		{
			champion: "MonkeyKing",
			against: "Annie",
			role: "mid",
			value: -1,
			reasons: ["range"],
		},
	]);
	const provenance = JSON.parse(first[3] ?? "");
	expect(provenance.snapshot.retrievedAt).toBe("2026-11-21T00:00:00Z");
	expect(provenance.catalog.url).toBe(catalogUrl);
	expect(provenance.games).toBe(2);
	expect(provenance.tierSeasons).toEqual({
		current: 2026,
		available: [2026, 2025, 2024],
		missing: [],
	});
	expect(JSON.parse(first[0] ?? "")[1].positions).toContainEqual({
		role: "jungle",
		tier: "B",
	});
	expect(first[3]).not.toContain('"name"');
	expect(provenance.kits).toMatchObject({ patch: "16.23", champions: 2, missing: [] });
	const kits = JSON.parse(
		await readFile(join(outputDir, "kits.json"), "utf8"),
	) as { id: string; ultCooldown: number[] }[];
	expect(kits.map(({ id, ultCooldown }) => [id, ultCooldown])).toEqual([
		["Annie", [150, 135, 120]],
		["MonkeyKing", [70, 50, 30]],
	]);
	const traits = JSON.parse(
		await readFile(join(outputDir, "traits.json"), "utf8"),
	);
	expect(traits[0].sources.range).toBe("source");
	expect(provenance.traitsToReview).toEqual([]);
});
