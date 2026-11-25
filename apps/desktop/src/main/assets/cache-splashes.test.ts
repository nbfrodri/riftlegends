import { readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
	ahriData,
	championData,
	jpeg,
	networkError,
	png,
	response,
	splash,
	tile,
	useCacheFixture,
} from "./cache-test-kit";
import { serveAsset } from "./protocol";

const ahriTile =
	"/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Base/Images/ahri_splash_tile_0.jpg";

const served = async (profile: string, path: string) =>
	serveAsset(profile, { url: `rift-asset://cdragon/${path}`, method: "GET" });

describe("#494: the base skin's landscape splash for the pick rows", () => {
	const t = useCacheFixture();
	const { create, source } = t;

	it("caches the centred splash next to the tile, from the same champion data", async () => {
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		const paths = t.requests.map(({ url }) => url.pathname);
		expect(paths).toContain(splash);
		expect(paths.filter((path) => path === championData)).toHaveLength(1);
		const image = await served(t.profile, "splashes/Ahri.jpg");
		expect(image.headers.get("content-type")).toBe("image/jpeg");
		expect(Buffer.from(await image.arrayBuffer())).toEqual(jpeg);
		const manifest = JSON.parse(
			await readFile(source(t.version, "manifest.json"), "utf8"),
		);
		expect(manifest.splashes).toBe(true);
		expect(manifest.files["splashes/Ahri.jpg"]).toBeDefined();
	});

	it.each([
		["a missing splash", splash, response("", 404)],
		[
			"an unexpected splash path",
			championData,
			response(ahriData(ahriTile, "/x.jpg")),
		],
		["no splash path", championData, response(ahriData(ahriTile, null))],
	])("keeps the tile when a champion has %s", async (_problem, path, reply) => {
		t.override = async (url) => (url.pathname === path ? reply : undefined);
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect((await served(t.profile, "splashes/Ahri.jpg")).status).toBe(404);
		expect((await served(t.profile, "tiles/Ahri.jpg")).status).toBe(200);
	});

	it("rejects a splash that is not a JPEG", async () => {
		t.override = async (url) =>
			url.pathname === splash ? response(png) : undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
	});

	it("refreshes an active cache made before splashes, and keeps it offline", async () => {
		await create().sync();
		const manifestPath = source(t.version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		delete manifest.files["splashes/Ahri.jpg"];
		delete manifest.splashes;
		await rm(source(t.version, "splashes"), { recursive: true });
		await writeFile(manifestPath, JSON.stringify(manifest));

		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});

		t.override = undefined;
		t.requests = [];
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(t.requests.map(({ url }) => url.pathname)).toContain(splash);
		expect(await readFile(source(t.version, "splashes", "Ahri.jpg"))).toEqual(
			jpeg,
		);
		expect(t.requests.map(({ url }) => url.pathname)).toContain(tile);
	});
});
