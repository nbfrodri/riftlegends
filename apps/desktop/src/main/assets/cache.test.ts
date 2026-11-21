import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAssetCache } from "./cache";
import { type AssetTransport, withResponse } from "./transport";

const versions = "/api/versions.json";
const portrait = "/cdn/16.23.1/img/champion/Ahri.png";
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
	let championId: string;
	let requests: Array<{ url: URL; headers: Record<string, string> }>;
	let override: AssetTransport | undefined;
	const transport: AssetTransport = async (url, headers, signal) => {
		requests.push({ url, headers });
		const special = await override?.(url, headers, signal);
		if (special) return special;
		if (url.pathname === versions)
			return response(JSON.stringify([version, "1.2.3"]));
		if (url.pathname.endsWith("champion.json")) {
			return response(
				JSON.stringify({ data: { [championId]: { id: championId } } }),
			);
		}
		return response(png);
	};
	const create = () => createAssetCache(profile, { transport });
	const source = (...parts: string[]) =>
		join(profile, "assets", "ddragon", ...parts);
	const part = () =>
		source("staging-16.23.1", "img", "champion", "Ahri.png.part");

	beforeEach(async () => {
		profile = await mkdtemp(join(tmpdir(), "rift-assets-"));
		version = "16.23.1";
		championId = "Ahri";
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

	it("D0 joins an in-flight sync, caches both locales and sources, and checks for a newer version", async () => {
		const cache = create();
		const pending = cache.sync();
		expect(cache.sync()).toBe(pending);
		expect(cache.getStatus()).toMatchObject({ state: "syncing" });
		expect(await pending).toEqual({ state: "ready", version });
		expect(
			requests.filter(({ url }) => url.pathname === versions),
		).toHaveLength(1);
		for (const locale of ["es_ES", "en_US"]) {
			expect(
				requests.some(
					({ url }) =>
						url.pathname === `/cdn/${version}/data/${locale}/champion.json`,
				),
			).toBe(true);
		}
		const icons = requests.filter(
			({ url }) => url.hostname === "raw.communitydragon.org",
		);
		expect(icons).toHaveLength(12);
		expect(
			requests.every(
				({ url, headers }) =>
					url.protocol === "https:" &&
					headers["Accept-Encoding"] === "identity",
			),
		).toBe(true);
		const manifest = JSON.parse(
			await readFile(source(version, "manifest.json"), "utf8"),
		);
		expect(manifest.files["img/champion/Ahri.png"]).toEqual({
			size: png.length,
			sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		});

		requests = [];
		expect(await create().sync()).toEqual({ state: "ready", version });
		expect(requests.map(({ url }) => url.pathname)).toEqual([versions]);

		version = "16.24.1";
		expect(await cache.sync()).toEqual({ state: "ready", version });
		expect(await readdir(source())).toEqual(["16.24.1", "current.json"]);
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
		version = "16.24.1";
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

	it.each(["ddragon", "cdragon"])(
		"D2 still opens the previous cache offline if activation stops at %s",
		async (failedSource) => {
			expect(await create().sync()).toEqual({ state: "ready", version });
			const old = version;
			version = "16.24.1";
			await mkdir(join(profile, "assets", failedSource, "current.json.tmp"));
			expect(await create().sync()).toMatchObject({ state: "error" });
			override = async () => {
				throw networkError("ENETUNREACH");
			};
			expect(await create().sync()).toEqual({ state: "ready", version: old });
		},
	);

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
			expect(
				await readFile(source(version, "img", "champion", "Ahri.png")),
			).toEqual(png);
			expect(
				requests.some(({ url }) => url.pathname.endsWith("champion.json")),
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
			const file = source(version, "img", "champion", "Ahri.png");
			if (mode === "deleted") await rm(file);
			if (mode === "changed") await writeFile(file, Buffer.alloc(png.length));
			override = async () => {
				throw networkError("ENETUNREACH");
			};
			expect(await create().sync()).toEqual(
				mode === "ok" ? { state: "ready", version } : { state: "missing" },
			);
		},
	);

	it.each(["../escape", "a/b", "..", "a\\b", "a%2fb", "a:b", "con"])(
		"D6 rejects champion ID %s before requesting a portrait",
		async (id) => {
			championId = id;
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
			version = invalidVersion;
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(requests.map(({ url }) => url.pathname)).toEqual([versions]);
		},
	);

	it("D6 rejects an active manifest path outside the cache", async () => {
		await create().sync();
		const manifestPath = source(version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest.files["../../outside.png"] =
			manifest.files["img/champion/Ahri.png"];
		await writeFile(manifestPath, JSON.stringify(manifest));
		override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({ state: "missing" });
	});

	it("D6 retries a poisoned catalog on the next sync", async () => {
		championId = "../escape";
		expect(await create().sync()).toMatchObject({ state: "error" });
		championId = "Ahri";
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
			await mkdir(source("staging-16.23.1"), { recursive: true });
			await symlink(outside, source("staging-16.23.1", "data"), "dir");
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(await readdir(outside)).toEqual([]);
		},
	);
});
