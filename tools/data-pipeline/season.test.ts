import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import type { CargoRow } from "./client.ts";
import { discoverSeason, mixLeagueGames, selectPages } from "./season.ts";

type Row = Record<string, string>;
const recorded = async (fixture = "tournaments-six-leagues") =>
	(
		JSON.parse(
			await readFile(
				new URL(`./fixtures/leaguepedia/${fixture}.json`, import.meta.url),
				"utf8",
			),
		).cargoquery as { title: Row }[]
	).map(({ title }) => title);

/** The recorded 2026 tournaments, moved to another year. */
function shifted(rows: Row[], year: number): Row[] {
	return rows.map((row) => ({
		...row,
		OverviewPage: row.OverviewPage?.replace("2026", String(year)) ?? "",
		Year: String(year),
		DateStart: row.DateStart?.replace(/^\d{4}/, String(year)) ?? "",
	}));
}

/** A Cargo stand-in: tournament listings by year and game counts by page. */
function fakeClient(rows: Row[], games: (page: string) => number) {
	return {
		cargo: async (
			table: string,
			fields: string,
			where: string,
			_order: string,
			options?: { group_by?: string },
		) => {
			if (table === "Tournaments") {
				expect(where).toContain("League IN (");
				const year = /Year='(\d+)'/.exec(where)?.[1];
				return rows.filter((row) => row.Year === year) as CargoRow[];
			}
			expect(table).toBe("ScoreboardGames");
			expect(fields).toContain("COUNT(*)");
			expect(options?.group_by).toBe("OverviewPage");
			return [...where.matchAll(/'((?:[^']|'')+)'/g)]
				.map((match) => (match[1] ?? "").replaceAll("''", "'"))
				.filter((page) => games(page) > 0)
				.map((page) => ({ OverviewPage: page, Games: String(games(page)) }));
		},
	};
}

const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];

it("S1 finds the 33 main tournaments of the current season and leaves out the rest", async () => {
	const rows = await recorded();
	const counts = new Map(
		(await recorded("games-by-tournament")).map(
			({ OverviewPage, GameCount }) => [OverviewPage, Number(GameCount)],
		),
	);
	const found = await discoverSeason(
		fakeClient(rows, (page) => counts.get(page) ?? 0),
		new Date("2026-11-22T12:00:00Z"),
	);
	const pages = found.scope.flatMap((league) => league.pages);
	expect(found.season).toBe(2026);
	expect(found.scope.map(({ id }) => id)).toEqual(leagues);
	expect(pages).toHaveLength(33);
	expect(new Set(pages).size).toBe(33);
	expect(pages.join("\n")).not.toMatch(
		/Showmatch|Promotion|Opening|Regional Finals/,
	);
	expect(found.scope.every((league) => !league.previousPages)).toBe(true);
});

it("S2 excludes exhibitions, qualifiers, promotions of the previous season and other leagues", async () => {
	const rows = await recorded();
	const lck = "LoL Champions Korea";
	const main = rows.find((row) => row.OverviewPage === "LCK/2026 Season/Cup");
	const extra: Row[] = [
		{ ...main, OverviewPage: "LCK/2026 Season/Relegation" },
		{ ...main, OverviewPage: "LCK/2026 Season/Exhibition" },
		{ ...rows[0], OverviewPage: "LCK 2026 Season Opening", League: "" },
		{
			...rows[0],
			OverviewPage: "LCK/2026 Season/Qualifier",
			League: lck,
			IsQualifier: "1",
		},
		{
			...rows[0],
			OverviewPage: "LCK/2026 Season/Unofficial",
			League: lck,
			IsOfficial: "0",
		},
		{
			...rows[0],
			OverviewPage: "LCK/2026 Season/Late 2025",
			League: lck,
			DateStart: "2025-12-20",
		},
		{ ...rows[0], OverviewPage: "Worlds 2026", League: "World Championship" },
	].map((row) => ({ ...row, Year: "2026" }) as Row);
	for (const row of extra) expect(selectPages([row], lck, 2026)).toEqual([]);
	const promotion = rows.find((row) =>
		/Promotion/.test(row.OverviewPage ?? ""),
	);
	expect(
		selectPages(
			[promotion as Row],
			"League of Legends Championship Pacific",
			2026,
		),
	).toEqual([]);
	const showmatch = rows.find((row) =>
		/Showmatch/.test(row.OverviewPage ?? ""),
	);
	expect(
		selectPages([showmatch as Row], "Tencent LoL Pro League", 2026),
	).toEqual([]);
});

it("S3 does not list a tournament before its first game", async () => {
	const rows = await recorded();
	const found = await discoverSeason(
		fakeClient(rows, (page) => (page.endsWith("Split 3") ? 0 : 50)),
		new Date("2026-08-01T00:00:00Z"),
	);
	const pages = found.scope.flatMap((league) => league.pages);
	expect(pages.some((page) => page.endsWith("Split 3"))).toBe(false);
	expect(found.season).toBe(2026);
});

it("S4 stays on the old season in January until every league has played a game", async () => {
	const rows = [...(await recorded()), ...shifted(await recorded(), 2027)];
	const found = await discoverSeason(
		fakeClient(rows, (page) =>
			page.includes("2027") ? (page.startsWith("LCK/") ? 4 : 0) : 50,
		),
		new Date("2027-01-16T00:00:00Z"),
	);
	expect(found.season).toBe(2026);
	expect(found.scope.flatMap((league) => league.pages)).toHaveLength(33);
});

it("S5 switches to the new season once all six leagues play, with the old one as previous pages", async () => {
	const rows = [...(await recorded()), ...shifted(await recorded(), 2027)];
	const found = await discoverSeason(
		fakeClient(rows, (page) => (page.includes("2027") ? 4 : 50)),
		new Date("2027-01-26T00:00:00Z"),
	);
	expect(found.season).toBe(2027);
	for (const league of found.scope) {
		expect(league.pages.every((page) => page.includes("2027"))).toBe(true);
		expect(league.previousPages?.length).toBeGreaterThan(0);
		expect(league.previousPages?.every((page) => page.includes("2026"))).toBe(
			true,
		);
	}
	expect(found.scope.flatMap((l) => l.previousPages ?? [])).toHaveLength(33);
});

it("S6 mixes in the previous season only below the league game threshold", async () => {
	const rows = [...(await recorded()), ...shifted(await recorded(), 2027)];
	const total = async (games: number) =>
		(
			await discoverSeason(
				fakeClient(rows, (page) =>
					page.startsWith("LCK/2027")
						? page.endsWith("/Cup")
							? games
							: 0
						: 100,
				),
				new Date("2027-06-01T00:00:00Z"),
			)
		).scope;
	const below = await total(mixLeagueGames - 1);
	const at = await total(mixLeagueGames);
	expect(below.find(({ id }) => id === "LCK")?.previousPages).toBeDefined();
	expect(at.find(({ id }) => id === "LCK")?.previousPages).toBeUndefined();
	// A league far above the threshold never needs it.
	expect(below.find(({ id }) => id === "LPL")?.previousPages).toBeUndefined();
});

it("S7 applies the explicit exceptions", async () => {
	const rows = await recorded();
	const found = await discoverSeason(
		fakeClient(rows, () => 50),
		new Date("2026-11-22T00:00:00Z"),
		{
			exclude: { LCK: ["LCK/2026 Season/Cup"] },
			include: { LCK: ["LCK 2026 Season Opening"] },
		},
	);
	const lck = found.scope.find(({ id }) => id === "LCK")?.pages ?? [];
	expect(lck).not.toContain("LCK/2026 Season/Cup");
	expect(lck).toContain("LCK 2026 Season Opening");
});
