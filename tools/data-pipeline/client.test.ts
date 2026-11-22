import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "./client.ts";

let cacheDir: string;
beforeEach(async () => {
	cacheDir = await mkdtemp(join(tmpdir(), "rift-cargo-"));
});
afterEach(async () => rm(cacheDir, { recursive: true, force: true }));

it("P2 serializes Cargo, spaces attempts and paginates with a stable tiebreak", async () => {
	let now = 0;
	const sleep = async (ms: number) => {
		now += ms;
	};
	const calls: [string, number][] = [];
	let active = 0;
	const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
		expect(++active).toBe(1);
		const url = new URL(String(input));
		expect(new Headers(init?.headers).get("user-agent")).toBe(
			"RiftLegendsDataPipeline/0.1",
		);
		expect(url.searchParams.get("maxlag")).toBe("5");
		expect(url.searchParams.get("limit")).toBe("500");
		expect(url.searchParams.get("order_by")).toBe("DateTime_UTC,GameId");
		const offset = url.searchParams.get("offset") ?? "";
		calls.push([offset, now]);
		await Promise.resolve();
		active--;
		return Response.json({
			cargoquery:
				offset === "0"
					? Array.from({ length: 500 }, (_, index) => ({
							title: { GameId: String(index) },
						}))
					: [],
		});
	});
	const client = new Client({ cacheDir, fetch, now: () => now, sleep });
	const read = (where: string) =>
		client.cargo("ScoreboardGames", "GameId", where, "DateTime_UTC,GameId");
	const pages = await Promise.all([read("Year=2026"), read("Year=2025")]);
	expect(pages.map((rows) => rows.length)).toEqual([500, 500]);
	expect(calls.map(([offset]) => offset).sort()).toEqual([
		"0",
		"0",
		"500",
		"500",
	]);
	expect(calls.map(([, time]) => time)).toEqual([0, 11000, 22000, 33000]);
});

it("P2 retries recorded ratelimited, synthetic maxlag and 429 with Retry-After", async () => {
	const limited = await readFile(
		new URL("./fixtures/leaguepedia/ratelimited.json", import.meta.url),
		"utf8",
	);
	let now = 0;
	const waits: number[] = [];
	const fetch = vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(new Response(limited))
		.mockResolvedValueOnce(Response.json({ error: { code: "maxlag" } }))
		.mockResolvedValueOnce(
			new Response(null, { status: 429, headers: { "Retry-After": "130" } }),
		)
		.mockResolvedValueOnce(
			Response.json({ cargoquery: [{ title: { GameId: "game" } }] }),
		);
	const client = new Client({
		cacheDir,
		fetch,
		now: () => now,
		sleep: async (ms) => {
			waits.push(ms);
			now += ms;
		},
	});
	await expect(
		client.cargo("ScoreboardGames", "GameId", "", "GameId"),
	).resolves.toEqual([{ GameId: "game" }]);
	expect(waits).toEqual([11000, 22000, 130000]);
});
