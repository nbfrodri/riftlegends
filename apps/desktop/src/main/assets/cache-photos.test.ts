import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAssetCache } from "./cache";
import { png, response, useCacheFixture } from "./cache-test-kit";

describe("main asset cache photos", () => {
	const t = useCacheFixture();
	const { transport } = t;

	it("A3 downloads player photos after the cache is ready and tells subscribers", async () => {
		const photo = Buffer.concat([png, Buffer.from("verified player photo")]);
		const url = "https://static.lolesports.com/players/MID.png";
		t.override = async (request) =>
			request.href === url ? response(photo) : undefined;
		const cache = createAssetCache(t.profile, {
			transport,
			photos: [
				{
					player: "mid",
					url,
					sha256: createHash("sha256").update(photo).digest("hex"),
					size: photo.length,
					mime: "image/png",
				},
			],
		});
		const changed = vi.fn();
		cache.subscribePlayerPhotos(changed);
		expect(await cache.getPlayerPhotos()).toEqual({});
		expect(await cache.sync()).toEqual({ state: "ready", version: t.version });
		expect(await cache.getPlayerPhotos()).toEqual({
			mid: "rift-asset://photos/players/mid.png",
		});
		expect(changed).toHaveBeenCalledTimes(1);
	});
});
