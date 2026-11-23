import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cacheFile } from "./client.ts";
import fixture from "./fixtures/lolesports/player-photos.json";
import { teamsUrl } from "./logos.ts";
import { writePhotos } from "./photos.ts";

const retrievedAt = "2026-11-22T13:36:54.780Z";
const png = Buffer.from("89504e470d0a1a0a", "hex");
const jpeg = Buffer.from("ffd8ffe0", "hex");
const aurora = "https://static.lolesports.com/players/aurora.png";
const zenith =
	"https://lolstatic-a.akamaihd.net/esports-assets/production/player/zenith.jpg";
let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "rift-player-photo-pipeline-"));
	await writeFile(
		cacheFile(root, teamsUrl),
		JSON.stringify({ retrievedAt, body: fixture }),
	);
	await writeFile(
		join(root, "teams.json"),
		JSON.stringify([{ id: "Team Liquid", name: "Team Liquid", league: "LCS" }]),
	);
	await writeFile(
		join(root, "players.json"),
		JSON.stringify(
			[
				["z", "aUrOrA"],
				["a", "Zenith"],
				["missing", "NoImage"],
				["ambiguous", "Dupe"],
				["placeholder", "Default"],
				["unsafe", "Unsafe"],
			].map(([id, handle]) => ({
				id,
				team: "Team Liquid",
				role: "mid",
				handle,
			})),
		),
	);
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test("uses cached getTeams, team and case-insensitive handle, writing only sorted image metadata", async () => {
	const fetcher = vi.fn<typeof fetch>(async (url) => {
		if (url === aurora) return new Response(png);
		if (url === zenith) return new Response(jpeg);
		throw new Error(`Unexpected download: ${url}`);
	});
	const options = {
		cacheDir: root,
		outputDir: root,
		fetch: fetcher,
		sleep: async () => {},
		maxAttempts: 1,
	};
	const result = await writePhotos(options);
	expect(result.photos).toBe(2);
	expect(result.unmatched).toEqual([
		{ player: "ambiguous", reason: "ambiguous handle" },
		{ player: "missing", reason: "no usable photo URL" },
		{ player: "placeholder", reason: "no usable photo URL" },
		{ player: "unsafe", reason: "no usable photo URL" },
	]);
	expect(
		fetcher.mock.calls.map(([url, init]) => [url, init?.redirect]),
	).toEqual([
		[zenith, "error"],
		[aurora, "error"],
	]);
	const file = join(root, "photos.json");
	const metadata = (
		player: string,
		url: string,
		bytes: Buffer,
		mime: string,
	) => ({
		player,
		url,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		size: bytes.length,
		mime,
	});
	const text = await readFile(file, "utf8");
	expect(JSON.parse(text)).toMatchObject({
		provenance: { source: "lolesports.com", endpoint: teamsUrl, retrievedAt },
		photos: [
			metadata("a", zenith, jpeg, "image/jpeg"),
			metadata("z", aurora, png, "image/png"),
		],
	});
	fetcher.mockClear();
	await writePhotos({ ...options, offline: true });
	expect(fetcher).not.toHaveBeenCalled();
	expect(await readFile(file, "utf8")).toBe(text);
});
