import { mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	champion,
	networkError,
	portrait,
	response,
	useCacheFixture,
	versions,
} from "./cache-test-kit";
import { withResponse } from "./transport";

describe("main asset cache hardening", () => {
	const t = useCacheFixture();
	const { create, source, transport } = t;

	it.each(["../escape", "a/b", "..", "a\\b", "a%2fb", "a:b", "con"])(
		"D6 rejects champion ID %s before requesting a portrait",
		async (id) => {
			t.catalog = [{ ...champion, alias: id }];
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(t.requests.some(({ url }) => url.pathname.endsWith(".png"))).toBe(
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
			t.versionsList = [invalidVersion, "16.22.1"];
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(t.requests.map(({ url }) => url.pathname)).toEqual([versions]);
		},
	);

	it("D6 rejects an active manifest path outside the cache", async () => {
		await create().sync();
		const manifestPath = source(t.version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest.files["../../outside.png"] = manifest.files["champions/Ahri.png"];
		await writeFile(manifestPath, JSON.stringify(manifest));
		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await create().sync()).toEqual({ state: "missing" });
	});

	it("D6 retries a poisoned catalog on the next sync", async () => {
		t.catalog = [{ ...champion, alias: "../escape" }];
		expect(await create().sync()).toMatchObject({ state: "error" });
		t.catalog = [champion];
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
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
		t.override = async (url) =>
			url.pathname === portrait
				? response("", 302, { location: "https://example.com/untrusted.png" })
				: undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		t.override = async (url) =>
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
		expect(t.requests.some(({ url }) => url.hostname === "example.com")).toBe(
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
			t.override = async (_url, _headers, signal) =>
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
			const outside = join(t.profile, "outside");
			await mkdir(outside);
			await mkdir(source("staging-16.23"), { recursive: true });
			await symlink(outside, source("staging-16.23", "upstream"), "dir");
			expect(await create().sync()).toMatchObject({ state: "error" });
			expect(await readdir(outside)).toEqual([]);
		},
	);
});
