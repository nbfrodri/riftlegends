import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import { person } from "./normalization.ts";
import {
	acquireNationalities,
	buildNationalities,
	countryCode,
	parseNationalities,
	preserveNationalities,
	serializeNationalities,
} from "./nationality.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-nationality-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

const fixture = async () =>
	JSON.parse(
		await readFile(
			new URL("./fixtures/leaguepedia/nationalities.json", import.meta.url),
			"utf8",
		),
	);

test("country names become ISO 3166-1 alpha-2 codes", () => {
	expect(countryCode("South Korea")).toBe("KR");
	expect(countryCode("China")).toBe("CN");
	expect(countryCode("Czech Republic")).toBe("CZ");
	expect(countryCode("Turkey")).toBe("TR");
	expect(countryCode("United States")).toBe("US");
	expect(countryCode("Taiwan")).toBe("TW");
	expect(countryCode("Hong Kong")).toBe("HK");
	expect(countryCode("France")).toBe("FR");
	expect(countryCode("Serbia")).toBe("RS");
	expect(countryCode("  Denmark ")).toBe("DK");
	expect(countryCode("Atlantis")).toBeUndefined();
	expect(countryCode("")).toBeUndefined();
	expect(countryCode(undefined)).toBeUndefined();
});

test("each player gets one code; the primary nationality wins over the country", async () => {
	const rows = (await fixture()).cargoquery.map(
		(row: { title: Record<string, string> }) => row.title,
	);
	const dual = person("Synthetic Dual (Disambiguator)").id;
	const result = buildNationalities(rows, [
		"Faker",
		"Kiin",
		dual,
		"Synthetic Unknown",
		"Synthetic Odd",
	]);
	expect(result.players).toEqual([
		{ id: "Faker", country: "KR" },
		{ id: "Kiin", country: "KR" },
		{ id: dual, country: "MA" },
	]);
	// Players without data are left out, so no flag is shown for them.
	expect(result.unmapped).toEqual(["Atlantis"]);
	// Disambiguators can hold real names: only a fingerprint is stored.
	expect(JSON.stringify(result)).not.toContain("Disambiguator");
});

test("ids outside the snapshot are dropped", () => {
	const result = buildNationalities(
		[{ Link: "Stranger", Country: "Denmark", NationalityPrimary: "" }],
		["Faker"],
	);
	expect(result.players).toEqual([]);
	expect(JSON.stringify(result)).not.toContain("Stranger");
});

test("two cargo queries join the players table by page, and answers are cached", async () => {
	const urls: URL[] = [];
	const body = await fixture();
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		urls.push(new URL(String(input)));
		return Response.json(body);
	});
	const client = new Client({ cacheDir: dir, fetch, sleep: async () => {} });
	const rows = await acquireNationalities(client, ["LCK/2026 Season/Cup"]);
	expect(urls).toHaveLength(2);
	for (const { searchParams } of urls) {
		expect(searchParams.get("tables")).toMatch(/Players=P/);
		expect(searchParams.get("fields")).toContain("P.Country=Country");
		expect(searchParams.get("fields")).toContain(
			"P.NationalityPrimary=NationalityPrimary",
		);
		expect(searchParams.get("where")).toContain("'LCK/2026 Season/Cup'");
		expect(searchParams.get("limit")).toBe("500");
	}
	expect(urls[0]?.searchParams.get("tables")).toContain("ScoreboardPlayers=SP");
	expect(urls[1]?.searchParams.get("tables")).toContain("TournamentPlayers=TP");
	// Links with a disambiguator are never kept in the rows or in the cache.
	expect(rows.map((row) => row.Link)).toContain(
		person("Synthetic Dual (Disambiguator)").id,
	);
	expect(JSON.stringify(rows)).not.toContain("Disambiguator");
	await acquireNationalities(client, ["LCK/2026 Season/Cup"]);
	expect(fetch).toHaveBeenCalledTimes(2);
});

const file = (country: string, retrievedAt = "2026-11-22") => ({
	provenance: {
		source: "Leaguepedia",
		domain: "lol.fandom.com",
		retrievedAt,
		licence: "CC BY-SA 3.0",
		attribution: "x",
		queries: [{ url: "https://x", retrievedAt }],
	},
	players: [{ id: "Faker", country }],
});

test("the file round-trips and only retrieval dates are ignored", async () => {
	const path = join(dir, "nationalities.json");
	const first = serializeNationalities(file("KR"));
	expect(parseNationalities(first)).toEqual(file("KR"));
	await writeFile(path, first);
	expect(await preserveNationalities(path, file("KR", "2026-12-01"))).toBe(
		first,
	);
	expect(await preserveNationalities(path, file("DK"))).not.toBe(first);
});

test("a malformed file or a bad country code is rejected", () => {
	expect(() => parseNationalities("{}")).toThrow();
	expect(() =>
		parseNationalities(serializeNationalities(file("Korea"))),
	).toThrow(/country/i);
});
