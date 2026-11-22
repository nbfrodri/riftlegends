import { createHash } from "node:crypto";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAssetCache } from "./cache";
import { serveAsset } from "./protocol";
import { type AssetTransport, withResponse } from "./transport";

const versions = "/api/versions.json";
const gameData = "plugins/rcp-be-lol-game-data/global";
const summary = (patch: string, locale: string) =>
	`/${patch}/${gameData}/${locale}/v1/champion-summary.json`;
const portrait = `/16.23/${gameData}/default/v1/champion-icons/103.png`;
const champion = {
	id: 103,
	alias: "Ahri",
	name: "Ahri",
	description: "The Nine-Tailed Fox",
	roles: ["mage", "assassin"],
	squarePortraitPath: "/lol-game-data/assets/v1/champion-icons/103.png",
};
const png = Buffer.from("89504e470d0a1a0a0102030405060708", "hex");
const etag = '"assets-1"';

function response(
	bytes: Buffer | string,
	status = 200,
	headers: Record<string, string> = {},
) {
	const buffer = Buffer.from(bytes);
	return {
		status,
		headers: { "content-length": String(buffer.length), etag, ...headers },
		body: (async function* () {
			yield buffer;
		})(),
	};
}

function networkError(code: string) {
	return Object.assign(new Error(code), { code });
}

describe("main asset cache", () => {
	let profile: string;
	let version: string;
	let catalog: unknown[];
	let versionsList: string[];
	let requests: Array<{ url: URL; headers: Record<string, string> }>;
	let override: AssetTransport | undefined;
	const transport: AssetTransport = async (url, headers, signal) => {
		requests.push({ url, headers });
		const special = await override?.(url, headers, signal);
		if (special) return special;
		if (url.pathname === versions)
			return response(JSON.stringify(versionsList));
		if (url.pathname.endsWith("champion-summary.json")) {
			const entries = url.pathname.includes("/es_es/")
				? catalog.map((entry) =>
						entry === champion
							? { ...champion, description: "La Mujer Zorro" }
							: entry,
					)
				: catalog;
			return response(JSON.stringify(entries));
		}
		return response(png);
	};
	const create = () => createAssetCache(profile, { transport });
	const source = (...parts: string[]) =>
		join(profile, "assets", "cdragon", ...parts);
	const part = () => source("staging-16.23", "champions", "Ahri.png.part");
	const lock = (pid: number) =>
		join(profile, "assets", `sync-${pid}-00000000-0000-4000-8000-000000000000`);

	beforeEach(async () => {
		profile = await mkdtemp(join(tmpdir(), "rift-assets-"));
		version = "16.23";
		versionsList = ["16.23.1", "16.22.1"];
		catalog = [
			{ id: -1, alias: "None", roles: [] },
			champion,
			{ id: 60001, alias: "Jade_Annie", roles: ["mage"] },
			{ id: 104, alias: "Placeholder", roles: [] },
		];
		requests = [];
		override = undefined;
	});
	afterEach(async () => {
		await rm(profile, { recursive: true, force: true });
	});

	async function interruptPortrait() {
		override = async (url) => {
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
		requests = [];
	}

	it("D0 waits for a live cache owner before issuing any request", async () => {
		await mkdir(lock(process.pid), { recursive: true });
		const pending = create().sync();
		try {
			const result = await Promise.race([
				pending,
				new Promise((resolve) => setTimeout(resolve, 200, "waiting")),
			]);
			expect(result).toBe("waiting");
			expect(requests).toEqual([]);
		} finally {
			await rm(lock(process.pid), { recursive: true, force: true });
			await pending;
		}
		expect(await pending).toEqual({ state: "ready", version });
	});

	it("D0 reclaims a cache lock left by a dead process", async () => {
		const deadOwner = lock(2_147_483_647);
		await mkdir(deadOwner, { recursive: true });
		expect(await create().sync()).toEqual({ state: "ready", version });
		expect(await readdir(join(profile, "assets"))).toEqual(["cdragon"]);
	});

	it("D0 reclaims an old cache lock whose pid was reused", async () => {
		const old = lock(process.pid);
		await mkdir(old, { recursive: true });
		const past = new Date(Date.now() - 2 * 60 * 60_000);
		await utimes(old, past, past);
		expect(await create().sync()).toEqual({ state: "ready", version });
	});

	it("D0 joins an in-flight sync, caches both locales and all icons, and checks for a newer version", async () => {
		const cache = create();
		expect(cache.getChampions()).toBeNull();
		const pending = cache.sync();
		expect(cache.sync()).toBe(pending);
		expect(cache.getStatus()).toMatchObject({ state: "syncing" });
		expect(await pending).toEqual({ state: "ready", version });
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
			requests.filter(({ url }) => url.pathname === versions),
		).toHaveLength(1);
		for (const locale of ["es_es", "en_gb"]) {
			expect(
				requests.some(({ url }) => url.pathname === summary(version, locale)),
			).toBe(true);
		}
		const icons = requests.filter(({ url }) =>
			url.pathname.startsWith("/latest/"),
		);
		expect(icons).toHaveLength(12);
		expect(
			requests.every(
				({ url, headers }) =>
					url.protocol === "https:" &&
					headers["Accept-Encoding"] === "identity",
			),
		).toBe(true);
		expect(
			requests
				.filter(({ url }) => url.pathname.includes("/champion-icons/"))
				.map(({ url }) => url.pathname),
		).toEqual([portrait]);
		const image = await serveAsset(profile, {
			url: "rift-asset://cdragon/champions/Ahri.png",
			method: "GET",
		});
		expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
		expect(
			JSON.parse(await readFile(source(version, "catalog", "es.json"), "utf8")),
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
			await readFile(source(version, "manifest.json"), "utf8"),
		);
		expect(manifest.files["champions/Ahri.png"]).toEqual({
			size: png.length,
			sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		});

		requests = [];
		expect(await create().sync()).toEqual({ state: "ready", version });
		expect(requests.map(({ url }) => url.pathname)).toEqual([versions]);

		version = "16.24";
		versionsList = ["16.24.1", "16.23.1"];
		expect(await cache.sync()).toEqual({ state: "ready", version });
		expect(await readdir(source())).toEqual(["16.24", "current.json"]);
	});

	it("falls back one distinct patch when either catalog is missing", async () => {
		versionsList = ["16.23.2", "16.23.1", "16.22.1", "16.21.1"];
		override = async (url) =>
			url.pathname === summary("16.23", "es_es")
				? response("", 404)
				: undefined;
		expect(await create().sync()).toEqual({ state: "ready", version: "16.22" });
		expect(
			requests.some(({ url }) => url.pathname === summary("16.22", "en_gb")),
		).toBe(true);
		expect(
			requests.some(
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
		catalog = entries;
		expect(await create().sync()).toMatchObject({ state: "error" });
		expect(requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
			false,
		);
	});

	it("rejects a mismatched numeric key across locales", async () => {
		override = async (url) =>
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
		expect(requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
			false,
		);
	});

	it.each(["ENETUNREACH", "EACCES", "ECONNRESET", "ETIMEDOUT"])(
		"D1 starts missing when the network reports %s",
		async (code) => {
			override = async () => {
				throw networkError(code);
			};
			expect(await create().sync()).toEqual({ state: "missing" });
		},
	);

	it("D2 keeps the previous cache when a new version is incomplete", async () => {
		expect(await create().sync()).toEqual({ state: "ready", version });
		const old = version;
		version = "16.24";
		versionsList = ["16.24.1", "16.23.1"];
		override = async (url) => {
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
		expect(await create().sync()).toEqual({ state: "ready", version });
		const old = version;
		version = "16.24";
		versionsList = ["16.24.1", "16.23.1"];
		await mkdir(source("current.json.tmp"));
		expect(await create().sync()).toMatchObject({ state: "error" });
		override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({ state: "ready", version: old });
	});

	it.each(["resume", "ignore", "416", "tamper", "wrong range"])(
		"D3 recovers an interrupted file (%s)",
		async (mode) => {
			await interruptPortrait();
			if (mode === "tamper") await writeFile(part(), Buffer.alloc(10));
			override = async (url, headers) => {
				if (url.pathname !== portrait || !headers.Range) return undefined;
				if (mode === "416") return response("", 416);
				if (mode === "ignore") return response(png);
				const start = mode === "wrong range" ? 9 : 10;
				return response(png.subarray(start), 206, {
					"content-range": `bytes ${start}-15/16`,
				});
			};
			expect(await create().sync()).toEqual({ state: "ready", version });
			expect(await readFile(source(version, "champions", "Ahri.png"))).toEqual(
				png,
			);
			expect(
				requests.some(({ url }) =>
					url.pathname.endsWith("champion-summary.json"),
				),
			).toBe(false);
			const portraitRequests = requests.filter(
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
			const file = source(version, "champions", "Ahri.png");
			if (mode === "deleted") await rm(file);
			if (mode === "changed") await writeFile(file, Buffer.alloc(png.length));
			override = async () => {
				throw networkError("ENETUNREACH");
			};
			const offline = create();
			expect(await offline.sync()).toEqual(
				mode === "ok" ? { state: "ready", version } : { state: "missing" },
			);
			if (mode === "ok") expect(offline.getChampions()?.[0]?.key).toBe(103);
			else expect(offline.getChampions()).toBeNull();
		},
	);

	it.each(["../escape", "a/b", "..", "a\\b", "a%2fb", "a:b", "con"])(
		"D6 rejects champion ID %s before requesting a portrait",
		async (id) => {
			catalog = [{ ...champion, alias: id }];
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
				false,
			);
		},
	);

	it.each([
		"../outside",
		"16.23.1/../../outside",
		"https://example.com",
		"16.23.1?x",
	])(
		"D6 rejects version %s before building URLs or paths",
		async (invalidVersion) => {
			versionsList = [invalidVersion, "16.22.1"];
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(requests.map(({ url }) => url.pathname)).toEqual([versions]);
		},
	);

	it("D6 rejects an active manifest path outside the cache", async () => {
		await create().sync();
		const manifestPath = source(version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest.files["../../outside.png"] = manifest.files["champions/Ahri.png"];
		await writeFile(manifestPath, JSON.stringify(manifest));
		override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({ state: "missing" });
	});

	it("D6 retries a poisoned catalog on the next sync", async () => {
		catalog = [{ ...champion, alias: "../escape" }];
		expect(await create().sync()).toMatchObject({ state: "error" });
		catalog = [champion];
		expect(await create().sync()).toEqual({ state: "ready", version });
	});

	it("D6 rejects a non-HTTPS URL even when it has an allowed origin", async () => {
		const request = vi.fn(transport);
		const url = new URL("blob:https://ddragon.leagueoflegends.com/file");
		await expect(
			withResponse(request, url, {}, async () => undefined),
		).rejects.toThrow("Invalid asset origin");
		expect(request).not.toHaveBeenCalled();
	});

	it("D6 rejects redirects and streamed files over the size limit", async () => {
		override = async (url) =>
			url.pathname === portrait
				? response("", 302, { location: "https://example.com/untrusted.png" })
				: undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		override = async (url) =>
			url.pathname === portrait
				? {
						status: 200,
						headers: {},
						body: (async function* () {
							yield Buffer.alloc(1024 * 1024 + 1);
						})(),
					}
				: undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		expect(requests.some(({ url }) => url.hostname === "example.com")).toBe(
			false,
		);
		await expect(readFile(source("current.json"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("D1 cancels a stalled request when its deadline expires", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		try {
			// Shorten the deadline while leaving real filesystem I/O alone.
			timeout.mockImplementation((ms) => {
				expect(ms).toBe(15_000);
				const controller = new AbortController();
				setTimeout(() => controller.abort(new Error("Deadline expired")), 1);
				return controller.signal;
			});
			override = async (_url, _headers, signal) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				});
			expect(await create().sync()).toEqual({ state: "missing" });
			expect(timeout).toHaveBeenCalledOnce();
		} finally {
			timeout.mockRestore();
		}
	});

	it.skipIf(process.platform === "win32")(
		"D6 never follows a staging symlink outside the cache",
		async () => {
			const outside = join(profile, "outside");
			await mkdir(outside);
			await mkdir(source("staging-16.23"), { recursive: true });
			await symlink(outside, source("staging-16.23", "upstream"), "dir");
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(await readdir(outside)).toEqual([]);
		},
	);

	it("A3 downloads team logos under their slug and lists their protocol URLs", async () => {
		const logo = Buffer.concat([png, Buffer.from("logo")]);
		const logoUrl = "https://static.lolesports.com/teams/A.png";
		override = async (url) =>
			url.host === "static.lolesports.com" ? response(logo) : undefined;
		const cache = create();
		expect(await cache.getTeamLogos()).toEqual({});
		const result = await cache.syncTeamLogos([
			{
				id: "Gen.G",
				url: logoUrl,
				sha256: createHash("sha256").update(logo).digest("hex"),
				size: logo.length,
				mime: "image/png",
			},
			{
				id: "Bad",
				url: logoUrl,
				sha256: "0".repeat(64),
				size: logo.length,
				mime: "image/png",
			},
		]);
		expect(result.failed).toEqual(["Bad"]);
		expect(await cache.getTeamLogos()).toEqual({
			"Gen.G": "rift-asset://logos/teams/gen-g.png",
		});
		const served = await serveAsset(profile, {
			url: "rift-asset://logos/teams/gen-g.png",
			method: "GET",
		});
		expect(Buffer.from(await served.arrayBuffer())).toEqual(logo);
	});
});
