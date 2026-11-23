import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAssetCache } from "./cache";
import { serveAsset } from "./protocol";
import type { AssetTransport } from "./transport";

const png = Buffer.from("89504e470d0a1a0a", "hex");
const jpeg = Buffer.from("ffd8ffe0", "hex");
const webp = Buffer.from("RIFF0000WEBP");
const url = "https://static.lolesports.com/players/portrait.png";
const local = "rift-asset://photos/players/portrait.png";
let root: string;

function source(player: string, body = png, mime = "image/png") {
	return {
		player,
		url,
		sha256: createHash("sha256").update(body).digest("hex"),
		size: body.length,
		mime,
	};
}

const response = (body: Uint8Array, status = 200) => ({
	status,
	headers: status === 302 ? { location: url } : {},
	body: (async function* () {
		yield body;
	})(),
});

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "rift-player-photos-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test("loads photos on demand, coalesces simultaneous reads, and serves only verified files", async () => {
	const transport = vi.fn<AssetTransport>(async () => response(png));
	const cache = createAssetCache(root, {
		transport,
		photos: [source("portrait")],
	});
	expect(transport).not.toHaveBeenCalled();
	await expect(
		Promise.all([cache.getPlayerPhotos(), cache.getPlayerPhotos()]),
	).resolves.toEqual([{ portrait: local }, { portrait: local }]);
	expect(transport).toHaveBeenCalledTimes(1);
	await expect(cache.getPlayerPhotos()).resolves.toEqual({ portrait: local });
	expect(transport).toHaveBeenCalledTimes(1);

	const get = (url: string) => serveAsset(root, { url, method: "GET" });
	const image = await get(local);
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(new Uint8Array(await image.arrayBuffer())).toEqual(
		new Uint8Array(png),
	);
	await writeFile(join(root, "assets/photos/players/other.png"), png);
	expect((await get("rift-asset://photos/players/other.png")).status).toBe(404);
	await writeFile(join(root, "assets/photos/players/portrait.png"), "tampered");
	expect((await get(local)).status).toBe(404);
});

test.each([
	["PNG", png, "image/png", "png"],
	["JPEG", jpeg, "image/jpeg", "jpg"],
	["WebP", webp, "image/webp", "webp"],
] as const)(
	"accepts %s magic bytes from the Riot CDN",
	async (_, bytes, mime, suffix) => {
		const cache = createAssetCache(root, {
			transport: async () => response(bytes),
			photos: [
				{
					...source("CON", bytes, mime),
					url: "https://lolstatic-a.akamaihd.net/esports-assets/production/player/remote.png",
				},
			],
		});
		expect((await cache.getPlayerPhotos()).CON).toMatch(
			new RegExp(`^rift-asset://photos/players/con-[a-f0-9]{8}\\.${suffix}$`),
		);
	},
);

test.each([
	{ url: url.replace("lolesports.com", "lolesports.com.example") },
	{ url: url.replace("lolesports.com", "lolesports.com:443") },
	{ url: url.replace("lolesports.com", "lolesports.com:444") },
	{ url: url.replace("static.", "user@static.") },
	{ url: url.replace("https:", "http:") },
	{ url: url.replace("/players/", "/teams/") },
	{ url: url.replace("/players/", "/wrong/../players/") },
	{ url: url.replace("portrait", "%2fportrait") },
	{ url: url.replace("portrait", "%2e%2eportrait") },
	{ url: `${url}?` },
	{ url: `${url}#` },
	{ url: url.replace(".png", ".svg") },
	{ mime: "image/svg+xml" },
	{ size: 0 },
	{ size: 512 * 1024 + 1 },
	{ sha256: "invalid" },
])("rejects unsafe photo metadata before transport %j", async (changes) => {
	const transport = vi.fn<AssetTransport>();
	const cache = createAssetCache(root, {
		transport,
		photos: [{ ...source("portrait"), ...changes }],
	});
	await expect(cache.getPlayerPhotos()).resolves.toEqual({});
	expect(transport).not.toHaveBeenCalled();
});

test.each([
	["wrong size", source("portrait", Buffer.concat([png, png])), png, 200],
	[
		"wrong checksum",
		{ ...source("portrait"), sha256: "0".repeat(64) },
		png,
		200,
	],
	["wrong type", source("portrait", jpeg), jpeg, 200],
	[
		"SVG bytes behind a PNG URL",
		source("portrait", Buffer.from("<svg/>")),
		Buffer.from("<svg/>"),
		200,
	],
	["large body", source("portrait"), Buffer.alloc(512 * 1024 + 1), 200],
	["redirect", source("portrait"), png, 302],
] as const)("rejects a response with %s", async (_, photo, bytes, status) => {
	const transport = vi.fn<AssetTransport>(async () => response(bytes, status));
	const cache = createAssetCache(root, { transport, photos: [photo] });
	await expect(cache.getPlayerPhotos()).resolves.toEqual({});
	expect(transport).toHaveBeenCalled();
	if (status === 302) expect(transport).toHaveBeenCalledTimes(1);
	expect((await serveAsset(root, { url: local, method: "GET" })).status).toBe(
		404,
	);
});
