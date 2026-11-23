import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import fixture from "./fixtures/lolesports/get-leagues.json";
import { writeLeagueLogos } from "./league-logos.ts";

const png = Buffer.from("89504e470d0a1a0a01020304", "hex");

test("writes sorted league and international event metadata from getLeagues", async () => {
	const root = await mkdtemp(join(tmpdir(), "league-pipeline-"));
	const fetcher = vi.fn<typeof fetch>(async (input) => {
		const url = new URL(String(input));
		return url.pathname.endsWith("/getLeagues")
			? Response.json(fixture)
			: new Response(png);
	});
	try {
		const options = {
			cacheDir: join(root, "cache"),
			outputDir: join(root, "output"),
			fetch: fetcher,
			sleep: async () => {},
			now: () => 0,
		};
		const result = await writeLeagueLogos(options);
		expect(result.unmatched).toEqual([]);
		const target = join(options.outputDir, "leagues.json");
		const body = await readFile(target, "utf8");
		const file = JSON.parse(body);
		expect(file.provenance.endpoint).toContain("/getLeagues");
		expect(file.leagues.map(({ id }: { id: string }) => id)).toEqual([
			"CBLOL",
			"First Stand",
			"LCK",
			"LCP",
			"LCS",
			"LEC",
			"LPL",
			"MSI",
			"Worlds",
		]);
		expect(file.leagues[1]).toEqual({
			id: "First Stand",
			url: "https://static.lolesports.com/leagues/first-stand.png",
			sha256: createHash("sha256").update(png).digest("hex"),
			size: png.length,
			mime: "image/png",
		});
		expect(fetcher).toHaveBeenCalledTimes(10);
		for (const [, init] of fetcher.mock.calls)
			expect(init?.redirect).toBe("error");
		await writeLeagueLogos({ ...options, offline: true });
		expect(await readFile(target, "utf8")).toBe(body);
		expect(fetcher).toHaveBeenCalledTimes(10);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("reports leagues with missing images without requesting them", async () => {
	const root = await mkdtemp(join(tmpdir(), "league-pipeline-"));
	const fetcher = vi.fn<typeof fetch>(async () =>
		Response.json({
			data: {
				leagues: [{ id: "1", slug: "lck", name: "LCK", region: "KOREA" }],
			},
		}),
	);
	try {
		const result = await writeLeagueLogos({
			cacheDir: root,
			outputDir: root,
			fetch: fetcher,
		});
		expect(result.unmatched).toContainEqual({
			id: "LCK",
			reason: "no usable logo URL",
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(await readFile(join(root, "leagues.json"), "utf8")).leagues,
		).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
