import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import { person } from "./normalization.ts";
import { acquirePlayerAliases } from "./player-aliases.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-aliases-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

test("redirected links map to the page they redirect to, without real names in the cache", async () => {
	const alias = "Synthetic Jungle (Kim Real-Name)";
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		const url = new URL(String(input));
		expect(url.searchParams.get("tables")).toContain("PlayerRedirects=PR");
		expect(url.searchParams.get("join_on")).toContain("PR.AllName");
		expect(url.searchParams.get("where")).toContain(
			"'LCP/2026 Season/Split 1'",
		);
		const rows = [
			{ Link: alias, Page: "Synthetic Jungle1" },
			// A link that is its own page is not an alias.
			{ Link: "Faker", Page: "Faker" },
		];
		return Response.json({ cargoquery: rows.map((title) => ({ title })) });
	});
	const client = new Client({ cacheDir: dir, fetch, sleep: async () => {} });
	const aliases = await acquirePlayerAliases(client, [
		"LCP/2026 Season/Split 1",
	]);
	expect([...aliases]).toEqual([[person(alias).id, "Synthetic Jungle1"]]);
	expect(JSON.stringify([...aliases])).not.toContain("Real-Name");
	await acquirePlayerAliases(client, ["LCP/2026 Season/Split 1"]);
	expect(fetch).toHaveBeenCalledTimes(2);
});
