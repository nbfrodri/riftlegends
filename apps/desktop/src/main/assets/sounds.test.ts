import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAssetCache } from "./cache";
import {
	championSelectSounds,
	readSounds,
	type SoundSource,
	syncSounds,
} from "./sounds";
import { type AssetTransport, NetworkUnavailable } from "./transport";

const ogg = (label: string) =>
	Buffer.concat([Buffer.from("OggS"), Buffer.from(label)]);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const official =
	"https://raw.communitydragon.org/16.23/plugins/rcp-fe-lol-champ-select/global/default/sounds";

function source(
	id: SoundSource["id"],
	bytes = ogg(id),
	url = `${official}/${id}.ogg`,
): SoundSource {
	return { id, url, size: bytes.length, sha256: sha(bytes) };
}

const response = (bytes: Buffer) => ({
	status: 200,
	headers: { "content-length": String(bytes.length) },
	body: (async function* () {
		yield bytes;
	})(),
});

/** Serves each URL's bytes; anything else is a 404. */
function server(files: Record<string, Buffer>) {
	return vi.fn<AssetTransport>(async (url) => {
		const bytes = files[url.href];
		return bytes
			? response(bytes)
			: { status: 404, headers: {}, body: (async function* () {})() };
	});
}

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "rift-sounds-"));
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("official champ-select sounds (#472)", () => {
	test("the draft and button sounds come from the champ-select plugin of a fixed CommunityDragon patch", () => {
		expect(championSelectSounds.map(({ id }) => id).sort()).toEqual([
			"ban",
			"click",
			"lock",
			"pick",
			"select",
			"swap",
		]);
		for (const { url, size, sha256 } of championSelectSounds) {
			expect(url).toMatch(
				/^https:\/\/raw\.communitydragon\.org\/\d+\.\d+\/plugins\/rcp-fe-lol-champ-select\/global\/default\/sounds\/sfx-[a-z0-9-]+\.ogg$/,
			);
			expect(size).toBeGreaterThan(0);
			expect(size).toBeLessThanOrEqual(256 * 1024);
			expect(sha256).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	test("the swap sound is the client's trade-accepted notification (#512)", () => {
		const swap = championSelectSounds.find(({ id }) => id === "swap");
		expect(swap?.url).toBe(`${official}/sfx-cs-notif-traderequest-accepted.ogg`);
		expect(swap?.size).toBe(52_815);
		expect(swap?.sha256).toBe(
			"1bc989a2f8a1bfc9f109f6015cdd46aca04907543ff3fee7e61871fbc832a052",
		);
	});

	test("downloads each sound once, verifies it and reads it back from disk", async () => {
		const sources = [source("select"), source("lock")];
		const transport = server({
			[sources[0]?.url ?? ""]: ogg("select"),
			[sources[1]?.url ?? ""]: ogg("lock"),
		});
		expect(await readSounds(root, sources)).toEqual({});
		await syncSounds(root, sources, transport);
		const read = await readSounds(root, sources);
		expect(Buffer.from(read.select ?? "")).toEqual(ogg("select"));
		expect(Buffer.from(read.lock ?? "")).toEqual(ogg("lock"));
		await syncSounds(root, sources, transport);
		expect(transport).toHaveBeenCalledTimes(2);
	});

	test.each([
		[
			"another host",
			source("select", ogg("select"), "https://evil.example/sfx.ogg"),
		],
		[
			"plain HTTP",
			source(
				"select",
				ogg("select"),
				`${official.replace("https", "http")}/select.ogg`,
			),
		],
		[
			"Data Dragon (allowed host, wrong source)",
			source(
				"select",
				ogg("select"),
				"https://ddragon.leagueoflegends.com/sfx.ogg",
			),
		],
		[
			"a type other than Ogg",
			source("select", ogg("select"), `${official}/select.mp3`),
		],
	])("rejects %s without requesting it", async (_, bad) => {
		const transport = server({ [bad.url]: ogg("select") });
		const { failed } = await syncSounds(root, [bad], transport);
		expect(failed).toEqual(["select"]);
		expect(transport).not.toHaveBeenCalled();
		expect(await readSounds(root, [bad])).toEqual({});
	});

	test.each([
		["an HTML error page", Buffer.from("<html>busy</html>")],
		["other bytes than the pinned ones", ogg("other")],
	])("rejects %s served with a 200", async (_, served) => {
		const good = source("select");
		const transport = server({ [good.url]: served });
		const { failed } = await syncSounds(root, [good], transport);
		expect(failed).toEqual(["select"]);
		expect(await readSounds(root, [good])).toEqual({});
	});

	test("a file changed on disk is not read", async () => {
		const good = source("ban");
		await syncSounds(root, [good], server({ [good.url]: ogg("ban") }));
		await writeFile(join(root, "draft", "ban.ogg"), ogg("bad"));
		expect(await readSounds(root, [good])).toEqual({});
	});

	test("offline, the sync stops and nothing is read: the renderer uses its own sounds", async () => {
		const sources = [source("select"), source("pick")];
		const transport = vi.fn<AssetTransport>(async () => {
			throw new NetworkUnavailable("offline");
		});
		await syncSounds(root, sources, transport);
		expect(transport).toHaveBeenCalledTimes(1);
		expect(await readSounds(root, sources)).toEqual({});
	});

	test("the asset cache syncs them with the optional assets and hands them out", async () => {
		const sources = [source("pick")];
		const cache = createAssetCache(root, {
			transport: server({ [sources[0]?.url ?? ""]: ogg("pick") }),
			sounds: sources,
		});
		expect(await cache.getSounds()).toEqual({});
		await cache.syncSounds();
		const sounds = await cache.getSounds();
		expect(Buffer.from(sounds.pick ?? "")).toEqual(ogg("pick"));
	});
});
