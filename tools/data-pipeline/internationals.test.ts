import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realInternationalsSchema } from "@rift-legends/contracts/real-internationals";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CargoRow } from "./client.ts";
import matchesFixture from "./fixtures/leaguepedia/international-matches.json";
import tournamentsFixture from "./fixtures/leaguepedia/international-tournaments.json";
import {
	internationals,
	parseMatches,
	selectInternationalPages,
} from "./internationals.ts";

const rows = (fixture: typeof matchesFixture): CargoRow[] =>
	fixture.cargoquery.map(({ title }) => title);

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "rift-intl-"));
});
afterEach(async () => rm(root, { recursive: true, force: true }));

it("I1 keeps the official tournaments of the three events and drops regional qualifiers", () => {
	const pages = selectInternationalPages(rows(tournamentsFixture), 2026);
	expect(pages.map(({ event, id }) => [event, id])).toEqual([
		["first-stand", "2026 First Stand"],
		["msi", "2026 Mid-Season Invitational"],
		["worlds", "2026 Season World Championship/Main Event"],
		["worlds", "2026 Season World Championship/Play-In"],
	]);
	expect(selectInternationalPages(rows(tournamentsFixture), 2025)).toEqual([]);
});

it("I2 reads every series with its score, Bo and date, in play order", () => {
	const matches = parseMatches(rows(matchesFixture));
	expect(matches).toHaveLength(79);
	expect(matches[0]).toEqual({
		tournament: "2026 First Stand",
		tab: "Groups Day 1",
		id: "2026 First Stand_Groups Day 1_1",
		date: "2026-03-16",
		team1: "Bilibili Gaming",
		team2: "BNK FEARX",
		score1: 3,
		score2: 2,
		bestOf: 5,
	});
	const worlds = matches.filter((m) => m.tournament.endsWith("Main Event"));
	// Natural order: match 2 comes before match 10 on the same day.
	const day = worlds.filter((m) => m.date === "2026-10-24").map((m) => m.id);
	expect(day).toEqual([...day].sort((a, b) => num(a) - num(b)));
});

const num = (id: string) => Number(id.split("_").at(-1));

it("I3 rejects a series that is unfinished or has an impossible score", () => {
	const [row] = rows(matchesFixture);
	for (const patch of [
		{ Team1Score: "2" },
		{ Team1Score: "3", Team2Score: "3" },
		{ BestOf: "4" },
		{ Team1Score: "x" },
	]) {
		expect(() => parseMatches([{ ...(row as CargoRow), ...patch }])).toThrow();
	}
});

it("I4 writes a validated, reproducible internationals.json from Cargo", async () => {
	const fetcher = vi.fn<typeof fetch>(async (input) => {
		const table = new URL(String(input)).searchParams.get("tables");
		return Response.json(
			table === "Tournaments" ? tournamentsFixture : matchesFixture,
		);
	});
	const options = {
		cacheDir: join(root, "cache"),
		outputDir: join(root, "out"),
		fetch: fetcher,
		sleep: async () => {},
		now: () => Date.UTC(2026, 10, 24),
	};
	const result = await internationals(options, 2026);
	expect(result.matches).toBe(79);
	expect(fetcher).toHaveBeenCalledTimes(2);
	const file = join(options.outputDir, "internationals.json");
	const body = await readFile(file, "utf8");
	const data = realInternationalsSchema.parse(JSON.parse(body));
	expect(data.season).toBe(2026);
	expect(data.events.map(({ id }) => id)).toEqual([
		"first-stand",
		"msi",
		"worlds",
	]);
	expect(data.events.map(({ matches }) => matches.length)).toEqual([
		13, 14 + 6, 40 + 6,
	]);
	expect(data.provenance.licence).toBe("CC BY-SA 3.0");
	await internationals({ ...options, offline: true }, 2026);
	expect(await readFile(file, "utf8")).toBe(body);
	expect(fetcher).toHaveBeenCalledTimes(2);
});

it("I5 fails when a tournament has no series", async () => {
	const fetcher = vi.fn<typeof fetch>(async (input) =>
		Response.json(
			new URL(String(input)).searchParams.get("tables") === "Tournaments"
				? tournamentsFixture
				: { cargoquery: [] },
		),
	);
	await expect(
		internationals(
			{
				cacheDir: join(root, "cache"),
				outputDir: join(root, "out"),
				fetch: fetcher,
				sleep: async () => {},
			},
			2026,
		),
	).rejects.toThrow(/2026 First Stand/);
});

it("I6 the schema rejects series between teams that are not named or scored", () => {
	const base = {
		tournament: "t",
		tab: "x",
		id: "t_x_1",
		date: "2026-01-01",
		team1: "A",
		team2: "B",
		score1: 3,
		score2: 0,
		bestOf: 5,
	};
	const wrap = (match: object) => ({
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			retrievedAt: "2026-11-24T00:00:00.000Z",
			licence: "CC BY-SA 3.0",
			attribution: "x",
			queries: [],
		},
		season: 2026,
		events: [
			{
				id: "msi",
				name: "MSI",
				tournaments: [
					{ id: "t", name: "T", startsOn: "2026-01-01", endsOn: "2026-01-02" },
				],
				matches: [match],
			},
		],
	});
	expect(realInternationalsSchema.safeParse(wrap(base)).success).toBe(true);
	for (const patch of [
		{ team2: "A" },
		{ score1: 2 },
		{ tournament: "other" },
		{ date: "yesterday" },
	]) {
		expect(
			realInternationalsSchema.safeParse(wrap({ ...base, ...patch })).success,
		).toBe(false);
	}
});
