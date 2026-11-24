import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
	ahriData,
	championData,
	jpeg,
	networkError,
	png,
	response,
	tile,
	useCacheFixture,
} from "./cache-test-kit";
import { serveAsset } from "./protocol";

describe("main asset cache tiles", () => {
	const t = useCacheFixture();
	const { create, source } = t;

	it("A3 caches each champion's base tile next to its icon", async () => {
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		const paths = t.requests.map(({ url }) => url.pathname);
		expect(paths).toContain(championData);
		expect(paths).toContain(tile);
		const image = await serveAsset(t.profile, {
			url: "rift-asset://cdragon/tiles/Ahri.jpg",
			method: "GET",
		});
		expect(image.headers.get("content-type")).toBe("image/jpeg");
		expect(Buffer.from(await image.arrayBuffer())).toEqual(jpeg);
		const manifest = JSON.parse(
			await readFile(source(t.version, "manifest.json"), "utf8"),
		);
		expect(manifest.files["tiles/Ahri.jpg"]).toEqual({
			size: jpeg.length,
			sha256: createHash("sha256").update(jpeg).digest("hex"),
		});
		// The champion data is only needed to stage the version.
		await expect(readdir(source(t.version, "upstream"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it.each([
		["missing champion data", championData, response("", 404)],
		["a missing tile", tile, response("", 404)],
		["an unexpected tile path", championData, response(ahriData("/x.jpg"))],
		["invalid champion data", championData, response("not json")],
	])(
		"A3 keeps the icon when a champion has %s",
		async (_problem, path, reply) => {
			t.override = async (url) => (url.pathname === path ? reply : undefined);
			expect(await create().sync()).toEqual({
				state: "ready",
				version: t.version,
			});
			const served = await serveAsset(t.profile, {
				url: "rift-asset://cdragon/tiles/Ahri.jpg",
				method: "GET",
			});
			expect(served.status).toBe(404);
			expect(
				(
					await serveAsset(t.profile, {
						url: "rift-asset://cdragon/champions/Ahri.png",
						method: "GET",
					})
				).status,
			).toBe(200);
			if (path === championData)
				expect(
					t.requests.some(({ url }) => url.pathname.endsWith(".jpg")),
				).toBe(false);
		},
	);

	it("A3 rejects a tile that is not a JPEG", async () => {
		t.override = async (url) =>
			url.pathname === tile ? response(png) : undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		await expect(readFile(source("current.json"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("A3 resumes an interrupted tile without fetching the champion data again", async () => {
		t.override = async (url) =>
			url.pathname === tile
				? {
						...response(jpeg),
						body: (async function* () {
							yield jpeg.subarray(0, 10);
							throw networkError("ECONNRESET");
						})(),
					}
				: undefined;
		expect(await create().sync()).toEqual({ state: "missing" });
		t.requests = [];
		t.override = async (url, headers) =>
			url.pathname === tile && headers.Range
				? response(jpeg.subarray(10), 206, {
						"content-range": `bytes 10-${jpeg.length - 1}/${jpeg.length}`,
					})
				: undefined;
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		const paths = t.requests.map(({ url }) => url.pathname);
		expect(paths).not.toContain(championData);
		expect(
			t.requests.find(({ url }) => url.pathname === tile)?.headers.Range,
		).toBe("bytes=10-");
		expect(await readFile(source(t.version, "tiles", "Ahri.jpg"))).toEqual(
			jpeg,
		);
	});

	it.each(["deleted", "changed"])(
		"A3 rejects an active cache whose tile was %s",
		async (mode) => {
			await create().sync();
			const file = source(t.version, "tiles", "Ahri.jpg");
			if (mode === "deleted") await rm(file);
			else await writeFile(file, Buffer.alloc(jpeg.length));
			t.override = async () => {
				throw networkError("ENETUNREACH");
			};
			expect(await create().sync()).toEqual({ state: "missing" });
		},
	);

	it("A3 refreshes an active cache made before tiles, and keeps it offline", async () => {
		await create().sync();
		const manifestPath = source(t.version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		delete manifest.files["tiles/Ahri.jpg"];
		delete manifest.tiles;
		await rm(source(t.version, "tiles"), { recursive: true });
		await writeFile(manifestPath, JSON.stringify(manifest));

		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		const offline = create();
		expect(await offline.sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(offline.getChampions()?.[0]?.key).toBe(103);

		t.override = undefined;
		t.requests = [];
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(t.requests.map(({ url }) => url.pathname)).toContain(tile);
		expect(await readFile(source(t.version, "tiles", "Ahri.jpg"))).toEqual(
			jpeg,
		);
	});
});
