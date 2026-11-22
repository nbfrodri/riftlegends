import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client, cacheFile } from "./client.ts";
import {
	acquireYear,
	buildHistory,
	historyYears,
	parseHistory,
	preserveHistory,
	serializeHistory,
	type YearData,
} from "./history.ts";
import { idResolver, person } from "./normalization.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-history-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

test("the history window is the span of seasons before the snapshot season", () => {
	expect(historyYears(2026, 7)).toEqual([
		2019, 2020, 2021, 2022, 2023, 2024, 2025,
	]);
	// Rolling the season forward moves 2026 into the history.
	expect(historyYears(2027, 7).at(-1)).toBe(2026);
	expect(historyYears(2027, 7)[0]).toBe(2020);
});

test("each season costs three aggregated Cargo queries", async () => {
	const urls: URL[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		urls.push(new URL(String(input)));
		return Response.json({ cargoquery: [] });
	});
	const client = new Client({
		cacheDir: dir,
		fetch,
		sleep: async () => {},
	});
	await acquireYear(client, 2024);
	expect(urls).toHaveLength(3);
	const [games, events, titles] = urls.map((url) => url.searchParams);
	expect(games?.get("group_by")).toBe("SP.Link");
	expect(games?.get("fields")).toContain("COUNT(*)");
	expect(games?.get("join_on")).toBe("SP.OverviewPage=T.OverviewPage");
	expect(games?.get("where")).toContain("T.Year='2024'");
	expect(games?.get("where")).toContain("'LoL Champions Korea'");
	expect(events?.get("where")).toContain("'World Championship'");
	expect(events?.get("group_by")).toBe("SP.Link,T.OverviewPage");
	expect(titles?.get("where")).toContain("TR.Place_Number='1'");
	expect(titles?.get("tables")).toContain("TournamentResults=TR");
	// A cached season is not requested again.
	await acquireYear(client, 2024);
	expect(fetch).toHaveBeenCalledTimes(3);
});

const faker = person("Faker").id;
const hashed = person("Alpha (Real Name)").id;
const year = (fields: Partial<YearData>): YearData => ({
	year: 2024,
	games: [],
	events: [],
	titles: [],
	...fields,
});

test("builds per-season records only for players of the snapshot", () => {
	const rows = buildHistory(
		[
			year({
				year: 2023,
				games: [
					{ Link: "Faker", Games: "88" },
					{ Link: "Stranger", Games: "40" },
				],
				events: [
					{ Link: "Faker", Page: "2023 Season World Championship/Play-In" },
					{ Link: "Faker", Page: "2023 Season World Championship/Main Event" },
					{ Link: "Faker", Page: "2023 Mid-Season Invitational/Main Event" },
					{ Link: "Faker", Page: "LCK/2023 Season/Regional Finals" },
				],
				titles: [
					{
						Link: "Faker",
						Page: "2023 Season World Championship/Main Event",
						League: "World Championship",
					},
					{
						Link: "Faker",
						Page: "LCK/2023 Season/Summer Playoffs",
						League: "LoL Champions Korea",
					},
					{
						Link: "Faker",
						Page: "2023 Season World Championship/Play-In",
						League: "World Championship",
					},
				],
			}),
		],
		[faker],
	);
	expect(rows).toEqual([
		{
			id: faker,
			seasons: [
				{
					year: 2023,
					games: 88,
					internationalEvents: 2,
					titles: 1,
					internationalTitles: 1,
				},
			],
		},
	]);
	expect(JSON.stringify(rows)).not.toContain("Stranger");
});

test("links with a disambiguator resolve by fingerprint, never storing the real name", () => {
	const resolve = idResolver([hashed, "xyno"]);
	expect(resolve("Alpha (Real Name)")).toBe(hashed);
	expect(resolve("Xyno")).toBe("xyno");
	expect(resolve("Nobody")).toBeUndefined();
	const rows = buildHistory(
		[year({ games: [{ Link: "Alpha (Real Name)", Games: "10" }] })],
		[hashed],
	);
	expect(JSON.stringify(rows)).not.toContain("Real Name");
});

test("the serialized file round-trips and only retrieval dates are ignored", async () => {
	const file = {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: "2026-11-22T00:00:00.000Z",
			licence: "CC BY-SA 3.0",
			attribution: "x",
			window: { from: 2019, to: 2025 },
			queries: [{ url: "u", retrievedAt: "2026-11-22T00:00:00.000Z" }],
		},
		players: [
			{
				id: faker,
				seasons: [
					{
						year: 2025,
						games: 80,
						internationalEvents: 1,
						titles: 0,
						internationalTitles: 0,
					},
				],
			},
		],
	};
	const text = serializeHistory(file);
	expect(parseHistory(text)).toEqual(file);
	const path = join(dir, "history.json");
	await writeFile(path, text);
	const later = {
		...file,
		provenance: {
			...file.provenance,
			retrievedAt: "2026-12-01T00:00:00.000Z",
			queries: [{ url: "u", retrievedAt: "2026-12-01T00:00:00.000Z" }],
		},
	};
	expect(await preserveHistory(path, later)).toBe(text);
	const changed = { ...later, players: [] };
	expect(await preserveHistory(path, changed)).toBe(serializeHistory(changed));
	expect(() =>
		parseHistory('{"players":[{"id":"a","seasons":[{}]}]}'),
	).toThrow();
	expect(await readFile(path, "utf8")).toBe(text);
});

test("historical Cargo cache replaces private disambiguators with fingerprints", async () => {
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		const query = new URL(String(input)).searchParams;
		return Response.json({
			cargoquery: query.get("fields")?.includes("COUNT(*)")
				? [{ title: { Link: "Alpha (Real Name)", Games: "10" } }]
				: [],
		});
	});
	const first = new Client({ cacheDir: dir, fetch, sleep: async () => {} });
	const downloaded = await acquireYear(first, 2024);
	expect(buildHistory([downloaded], [hashed])).toHaveLength(1);
	for (const url of first.queries.keys()) {
		const bytes = await readFile(cacheFile(dir, url), "utf8");
		expect(bytes).not.toContain("Real Name");
	}
	const offline = new Client({ cacheDir: dir, offline: true, fetch });
	expect(await acquireYear(offline, 2024)).toEqual(downloaded);
	expect(fetch).toHaveBeenCalledTimes(3);
});
