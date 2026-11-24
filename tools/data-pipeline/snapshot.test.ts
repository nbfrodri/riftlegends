import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { expect, it, vi } from "vitest";
import { cacheFile } from "./client.ts";
import { dataDragonUrl } from "./scope.ts";
import {
	cacheDir,
	offline,
	outputDir,
	pointInTime,
	scope,
	seedCache,
} from "./snapshot.fixtures.ts";
import { snapshot } from "./snapshot.ts";

it("P5 keeps snapshot bytes when a refresh only changes retrieval timestamps", async () => {
	await seedCache();
	const first = await offline();
	for (const file of await readdir(cacheDir)) {
		const path = join(cacheDir, file);
		const entry = JSON.parse(await readFile(path, "utf8"));
		entry.retrievedAt = "2026-11-29T12:00:00.000Z";
		await writeFile(path, JSON.stringify(entry));
	}
	expect(await offline()).toBe(first);
});

it("P1 regenerates identical bytes offline from recorded responses, with stable key and row order", async () => {
	await seedCache();
	const first = await offline();
	// Reordering object fields and rows in the cache has no effect on the output.
	for (const file of await readdir(cacheDir)) {
		const path = join(cacheDir, file);
		const entry = JSON.parse(await readFile(path, "utf8"));
		if (entry.body.cargoquery) {
			entry.body.cargoquery.reverse();
			for (const item of entry.body.cargoquery)
				item.title = Object.fromEntries(Object.entries(item.title).reverse());
			await writeFile(path, JSON.stringify(entry));
		}
	}
	expect(await offline()).toBe(first);
	const { league, provenance, teams, games } = JSON.parse(first);
	expect(Object.keys(JSON.parse(first))).toEqual([
		"provenance",
		"league",
		"tournaments",
		"teams",
		"rosters",
		"seasonPlayers",
		"games",
	]);
	expect(league.id).toBe("LCK");
	expect(
		provenance.queries.find(({ url }: { url: string }) =>
			url.includes("tables=Tournaments"),
		).retrievedAt,
	).toBe(pointInTime);
	expect(teams.map(({ id }: { id: string }) => id)).toEqual(
		teams.map(({ id }: { id: string }) => id).sort(),
	);
	expect(teams.find(({ id }: { id: string }) => id === "T1").logo.sha1).toBe(
		"c".repeat(40),
	);
	const firstGame = games[0];
	expect(firstGame.lengthSeconds).toBe(1927);
	expect(
		firstGame.teams.find(({ id }: { id: string }) => id === "HANJIN BRION"),
	).toMatchObject({
		side: "blue",
		picks: ["Neeko", "JarvanIV", "Cassiopeia", "Jhin", "Yorick"],
	});
	expect(firstGame.teams[1].bans.slice(0, 2)).toEqual(["MonkeyKing", null]);
	expect(
		firstGame.lines.find(
			({ player }: { player: string }) => player === "Casting",
		).visionScore,
	).toBeUndefined();
	expect(first).toContain("MonkeyKing");
	expect(first).not.toContain("Private Placeholder");
});

it("P2 aborts after N failures without touching a previous snapshot", async () => {
	await mkdir(outputDir);
	const previous = join(outputDir, "lck.json");
	await writeFile(previous, "previous bytes");
	let now = 0;
	const fetch = vi.fn<typeof globalThis.fetch>(async () =>
		Response.json({ error: { code: "maxlag" } }),
	);
	await expect(
		snapshot({
			cacheDir,
			outputDir,
			scope,
			fetch,
			maxAttempts: 3,
			now: () => now,
			sleep: async (ms) => {
				now += ms;
			},
		}),
	).rejects.toThrow("maxlag");
	expect(fetch).toHaveBeenCalledTimes(3);
	expect(await readdir(outputDir)).toEqual(["lck.json"]);
	expect(await readFile(previous, "utf8")).toBe("previous bytes");
});

it("P3 requires provenance even when all the data are valid", async () => {
	await seedCache();
	const valid = JSON.parse(await offline());
	expect(realSnapshotSchema.safeParse(valid).success).toBe(true);
	delete valid.provenance;
	expect(realSnapshotSchema.safeParse(valid).success).toBe(false);
});

it("reports an offline cache miss and preserves a previously written file", async () => {
	await seedCache();
	const first = await offline();
	await rm(cacheFile(cacheDir, dataDragonUrl));
	await expect(offline()).rejects.toThrow("Offline cache miss");
	expect(await readFile(join(outputDir, "lck.json"), "utf8")).toBe(first);
});
