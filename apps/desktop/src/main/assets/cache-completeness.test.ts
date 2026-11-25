import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import type { AssetProgress } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { createAssetCache } from "./cache";
import { networkError, response, useCacheFixture } from "./cache-test-kit";
import type { SoundSource } from "./sounds";

const oggBytes = Buffer.from("OggS-test-sound");
const oggPath = "/16.23/plugins/rcp-fe-lol-champ-select/global/default/sounds";
const sounds: SoundSource[] = (["select", "pick"] as const).map((id) => ({
	id,
	url: `https://raw.communitydragon.org${oggPath}/${id}.ogg`,
	size: oggBytes.length,
	sha256: createHash("sha256").update(oggBytes).digest("hex"),
}));

describe("#555: startup waits until the cache has everything the app uses", () => {
	const t = useCacheFixture();
	const { source } = t;
	const withSounds = () =>
		createAssetCache(t.profile, { transport: t.transport, sounds });
	const serveSounds = async (url: URL) =>
		url.pathname.endsWith(".ogg") ? response(oggBytes) : undefined;

	/** Installs a complete cache and strips what the test wants missing. */
	async function installed(strip: "splashes" | "sounds" | "none") {
		t.override = serveSounds;
		const first = withSounds();
		await first.sync();
		await first.getSounds();
		if (strip === "splashes") {
			const manifestPath = source(t.version, "manifest.json");
			const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
			delete manifest.files["splashes/Ahri.jpg"];
			delete manifest.splashes;
			await rm(source(t.version, "splashes"), { recursive: true });
			await writeFile(manifestPath, JSON.stringify(manifest));
		}
		if (strip === "sounds")
			await rm(`${t.profile}/assets/sounds`, { recursive: true });
		t.override = undefined;
		t.requests = [];
	}

	/** Starts the app's startup sync and waits for the background downloads too. */
	async function startup(cache: ReturnType<typeof createAssetCache>) {
		const result = await cache.sync(true);
		await cache.getSounds();
		return result;
	}

	function watch(cache: ReturnType<typeof createAssetCache>) {
		const seen: AssetProgress[] = [];
		cache.subscribe((progress) => seen.push(progress));
		return seen;
	}

	it("holds the gate while splashes are missing and enters once they are cached", async () => {
		await installed("splashes");
		const cache = withSounds();
		const seen = watch(cache);
		t.override = serveSounds;
		expect(await startup(cache)).toEqual({
			state: "ready",
			version: t.version,
		});
		// Never offers the installed catalog, so the loading screen keeps waiting.
		expect(seen.filter((progress) => progress.cachedVersion)).toEqual([]);
		const held = seen.filter((progress) => progress.incomplete);
		expect(held.length).toBeGreaterThan(1);
		expect(held.at(-1)?.completed).toBe(held.at(-1)?.total);
	});

	it("holds the gate while official sounds are missing and downloads them", async () => {
		await installed("sounds");
		const cache = withSounds();
		const seen = watch(cache);
		t.override = serveSounds;
		expect(await startup(cache)).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(seen.filter((progress) => progress.cachedVersion)).toEqual([]);
		expect(
			seen.some(
				(progress) => progress.incomplete && progress.total === sounds.length,
			),
		).toBe(true);
		expect(Object.keys(await cache.getSounds())).toHaveLength(sounds.length);
	});

	it("enters at once, without holding the gate, when the cache is complete", async () => {
		await installed("none");
		const cache = withSounds();
		const seen = watch(cache);
		expect(await startup(cache)).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(seen.some((p) => p.cachedVersion === t.version)).toBe(true);
		for (const progress of seen) expect(progress.incomplete).toBeUndefined();
	});

	it("offline with an incomplete cache is ready with a fallback notice", async () => {
		await installed("splashes");
		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await startup(withSounds())).toEqual({
			state: "ready",
			version: t.version,
			incomplete: true,
		});
	});

	it("offline with missing sounds is ready with a fallback notice", async () => {
		await installed("sounds");
		t.override = async () => {
			throw networkError("ENETUNREACH");
		};
		expect(await startup(withSounds())).toEqual({
			state: "ready",
			version: t.version,
			incomplete: true,
		});
	});

	it("completes an incomplete cache whose patch is no longer offered", async () => {
		await installed("splashes");
		t.versionsList = ["16.25.1", "16.24.1"];
		t.override = async (url) => {
			if (
				url.pathname.startsWith("/16.25/") ||
				url.pathname.startsWith("/16.24/")
			)
				return response("", 404);
			return serveSounds(url);
		};
		const cache = withSounds();
		expect(await startup(cache)).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(
			(await readFile(source(t.version, "splashes", "Ahri.jpg"))).length,
		).toBeGreaterThan(0);
	});

	it("moves to a complete newer patch when the cache is incomplete", async () => {
		await installed("splashes");
		t.versionsList = ["16.24.1", "16.23.1"];
		t.override = serveSounds;
		const result = await startup(withSounds());
		expect(result).toEqual({ state: "ready", version: "16.24" });
	});

	it("keeps an incomplete cache usable when the download fails for another reason", async () => {
		await installed("splashes");
		t.override = async (url) =>
			url.pathname.endsWith("champion-summary.json")
				? response("", 500)
				: serveSounds(url);
		expect(await startup(withSounds())).toEqual({
			state: "ready",
			version: t.version,
			incomplete: true,
		});
	});
});
