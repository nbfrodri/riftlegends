import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
	champion,
	etag,
	networkError,
	png,
	portrait,
	response,
	statIcons,
	summary,
	useCacheFixture,
	versions,
} from "./cache-test-kit";
import { serveAsset } from "./protocol";

describe("main asset cache", () => {
	const t = useCacheFixture();
	const { create, source } = t;
	const part = () => source("staging-16.23", "champions", "Ahri.png.part");

	async function interruptPortrait() {
		t.override = async (url) => {
			if (url.pathname !== portrait) return undefined;
			return {
				...response(png),
				body: (async function* () {
					yield png.subarray(0, 10);
					throw networkError("ECONNRESET");
				})(),
			};
		};
		expect(await create().sync()).toEqual({ state: "missing" });
		expect(await readFile(part())).toEqual(png.subarray(0, 10));
		await expect(readFile(source("current.json"))).rejects.toMatchObject({
			code: "ENOENT",
		});
		t.requests = [];
	}

	it("makes the installed catalog available while startup checks for an update", async () => {
		await create().sync();
		const cache = create();
		let release = () => {};
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		t.override = async () => {
			await hold;
			return response(JSON.stringify(t.versionsList));
		};
		const pending = cache.sync(true);
		try {
			await vi.waitFor(() =>
				expect(cache.getStatus()).toMatchObject({
					state: "syncing",
					progress: { cachedVersion: t.version },
				}),
			);
			expect(cache.getChampions()?.[0]?.id).toBe("Ahri");
		} finally {
			release();
			await pending;
		}
	});

	it("D0 joins an in-flight sync, caches both locales and all icons, and checks for a newer version", async () => {
		const cache = create();
		expect(cache.getChampions()).toBeNull();
		const pending = cache.sync();
		expect(cache.sync()).toBe(pending);
		expect(cache.getStatus()).toMatchObject({ state: "syncing" });
		expect(await pending).toEqual({ state: "ready", version: t.version });
		expect(cache.getChampions()).toEqual([
			{
				id: "Ahri",
				key: 103,
				names: { es: "Ahri", en: "Ahri" },
				titles: { es: "La Mujer Zorro", en: "The Nine-Tailed Fox" },
				classes: ["mage", "assassin"],
			},
		]);
		expect(
			t.requests.filter(({ url }) => url.pathname === versions),
		).toHaveLength(1);
		for (const locale of ["es_es", "en_gb"]) {
			expect(
				t.requests.some(
					({ url }) => url.pathname === summary(t.version, locale),
				),
			).toBe(true);
		}
		const icons = t.requests.filter(({ url }) =>
			url.pathname.startsWith("/latest/"),
		);
		expect(icons).toHaveLength(12 + Object.keys(statIcons).length);
		expect(
			t.requests.every(
				({ url, headers }) =>
					url.protocol === "https:" &&
					headers["Accept-Encoding"] === "identity",
			),
		).toBe(true);
		expect(
			t.requests
				.filter(({ url }) => url.pathname.includes("/champion-icons/"))
				.map(({ url }) => url.pathname),
		).toEqual([portrait]);
		const image = await serveAsset(t.profile, {
			url: "rift-asset://cdragon/champions/Ahri.png",
			method: "GET",
		});
		expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
		expect(
			JSON.parse(
				await readFile(source(t.version, "catalog", "es.json"), "utf8"),
			),
		).toEqual([
			{
				id: "Ahri",
				key: 103,
				name: "Ahri",
				title: "La Mujer Zorro",
				classes: ["mage", "assassin"],
			},
		]);
		const manifest = JSON.parse(
			await readFile(source(t.version, "manifest.json"), "utf8"),
		);
		expect(manifest.files["champions/Ahri.png"]).toEqual({
			size: png.length,
			sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		});

		t.requests = [];
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(t.requests.map(({ url }) => url.pathname)).toEqual([versions]);

		t.version = "16.24";
		t.versionsList = ["16.24.1", "16.23.1"];
		expect(await cache.sync()).toEqual({ state: "ready", version: t.version });
		expect(await readdir(source())).toEqual(["16.24", "current.json"]);
	});

	it("falls back one distinct patch when either catalog is missing", async () => {
		t.versionsList = ["16.23.2", "16.23.1", "16.22.1", "16.21.1"];
		t.override = async (url) =>
			url.pathname === summary("16.23", "es_es")
				? response("", 404)
				: undefined;
		expect(await create().sync()).toEqual({ state: "ready", version: "16.22" });
		expect(
			t.requests.some(({ url }) => url.pathname === summary("16.22", "en_gb")),
		).toBe(true);
		expect(
			t.requests.some(
				({ url }) =>
					url.pathname.startsWith("/16.23/") && url.pathname.endsWith(".png"),
			),
		).toBe(false);
	});

	it.each([
		[
			"duplicate alias",
			[
				champion,
				{
					...champion,
					id: 104,
					alias: "ahri",
					squarePortraitPath: "/lol-game-data/assets/v1/champion-icons/104.png",
				},
			],
		],
		["duplicate numeric key", [champion, { ...champion, alias: "Other" }]],
		["too many entries", Array(513).fill(champion)],
		["oversized numeric key", [{ ...champion, id: 100_000_000 }]],
		[
			"a mismatched portrait path",
			[
				{
					...champion,
					squarePortraitPath: "/lol-game-data/assets/v1/champion-icons/104.png",
				},
			],
		],
		[
			"a foreign portrait URL",
			[{ ...champion, squarePortraitPath: "https://example.com/103.png" }],
		],
	])("rejects %s before requesting images", async (_problem, entries) => {
		t.catalog = entries;
		expect(await create().sync()).toMatchObject({ state: "error" });
		expect(t.requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
			false,
		);
	});

	it("rejects a mismatched numeric key across locales", async () => {
		t.override = async (url) =>
			url.pathname === summary("16.23", "es_es")
				? response(
						JSON.stringify([
							{
								...champion,
								id: 104,
								squarePortraitPath:
									"/lol-game-data/assets/v1/champion-icons/104.png",
							},
						]),
					)
				: undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		expect(t.requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
			false,
		);
	});

	it.each(["ENETUNREACH", "EACCES", "ECONNRESET", "ETIMEDOUT"])(
		"D1 starts missing when the network reports %s",
		async (code) => {
			t.override = async () => {
				throw networkError(code);
			};
			expect(await create().sync()).toEqual({ state: "missing" });
		},
	);

	it("D2 keeps the previous cache when a new version is incomplete", async () => {
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		const old = t.version;
		t.version = "16.24";
		t.versionsList = ["16.24.1", "16.23.1"];
		t.override = async (url) => {
			if (url.hostname === "raw.communitydragon.org")
				throw networkError("ECONNRESET");
			return undefined;
		};
		expect(await create().sync()).toEqual({ state: "ready", version: old });
		expect(JSON.parse(await readFile(source("current.json"), "utf8"))).toEqual({
			version: old,
		});
	});

	it("D2 still opens the previous cache offline if activation fails", async () => {
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		const old = t.version;
		t.version = "16.24";
		t.versionsList = ["16.24.1", "16.23.1"];
		await mkdir(source("current.json.tmp"));
		expect(await create().sync()).toMatchObject({ state: "error" });
		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({ state: "ready", version: old });
	});

	it.each(["resume", "ignore", "416", "tamper", "wrong range"])(
		"D3 recovers an interrupted file (%s)",
		async (mode) => {
			await interruptPortrait();
			if (mode === "tamper") await writeFile(part(), Buffer.alloc(10));
			t.override = async (url, headers) => {
				if (url.pathname !== portrait || !headers.Range) return undefined;
				if (mode === "416") return response("", 416);
				if (mode === "ignore") return response(png);
				const start = mode === "wrong range" ? 9 : 10;
				return response(png.subarray(start), 206, {
					"content-range": `bytes ${start}-15/16`,
				});
			};
			expect(await create().sync()).toEqual({
				state: "ready",
				version: t.version,
			});
			expect(
				await readFile(source(t.version, "champions", "Ahri.png")),
			).toEqual(png);
			expect(
				t.requests.some(({ url }) =>
					url.pathname.endsWith("champion-summary.json"),
				),
			).toBe(false);
			const portraitRequests = t.requests.filter(
				({ url }) => url.pathname === portrait,
			);
			expect(portraitRequests.map(({ headers }) => headers.Range)).toEqual(
				mode === "tamper"
					? [undefined]
					: mode === "416" || mode === "wrong range"
						? ["bytes=10-", undefined]
						: ["bytes=10-"],
			);
			if (mode !== "tamper")
				expect(portraitRequests[0]?.headers["If-Range"]).toBe(etag);
		},
	);

	it.each(["ok", "deleted", "changed"])(
		"D4 revalidates active files offline (%s)",
		async (mode) => {
			await create().sync();
			const file = source(t.version, "champions", "Ahri.png");
			if (mode === "deleted") await rm(file);
			if (mode === "changed") await writeFile(file, Buffer.alloc(png.length));
			t.override = async () => {
				throw networkError("ENETUNREACH");
			};
			const offline = create();
			expect(await offline.sync()).toEqual(
				mode === "ok"
					? { state: "ready", version: t.version }
					: { state: "missing" },
			);
			if (mode === "ok") expect(offline.getChampions()?.[0]?.key).toBe(103);
			else expect(offline.getChampions()).toBeNull();
		},
	);
});
