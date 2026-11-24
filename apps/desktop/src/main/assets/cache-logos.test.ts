import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAssetCache } from "./cache";
import { jpeg, png, response, useCacheFixture } from "./cache-test-kit";
import { serveAsset } from "./protocol";

describe("main asset cache logos", () => {
	const t = useCacheFixture();
	const { create, transport } = t;

	it("A3 syncs the snapshot logos when the champion cache is ready", async () => {
		const logo = Buffer.concat([png, Buffer.from("verified team logo")]);
		const url = "https://static.lolesports.com/teams/GEN.png";
		t.override = async (request) =>
			request.href === url ? response(logo) : undefined;
		const cache = createAssetCache(t.profile, {
			transport,
			logos: [
				{
					team: "Gen.G",
					url,
					sha256: createHash("sha256").update(logo).digest("hex"),
					size: logo.length,
					mime: "image/png",
				},
			],
		});
		expect(await cache.sync()).toEqual({ state: "ready", version: t.version });
		expect(await cache.getTeamLogos()).toEqual({
			"Gen.G": "rift-asset://logos/teams/gen-g.png",
		});
		await cache.sync();
		await cache.getTeamLogos();
		expect(
			t.requests.filter((request) => request.url.href === url),
		).toHaveLength(1);
	});

	it("A3 tells subscribers when a logo sync finishes", async () => {
		const cache = createAssetCache(t.profile, { transport });
		const changed = vi.fn();
		const stop = cache.subscribeTeamLogos(changed);
		await cache.syncTeamLogos([]);
		expect(changed).toHaveBeenCalledTimes(1);
		stop();
		await cache.syncTeamLogos([]);
		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("syncs league logos on cache readiness and refreshes the renderer", async () => {
		const url = "https://static.lolesports.com/leagues/lck.png";
		t.override = async (request) =>
			request.href === url ? response(png) : undefined;
		const cache = createAssetCache(t.profile, {
			transport,
			leagueLogos: [
				{
					id: "LCK",
					url,
					sha256: createHash("sha256").update(png).digest("hex"),
					size: png.length,
					mime: "image/png",
				},
			],
		});
		const changed = vi.fn();
		cache.subscribeTeamLogos(changed);
		expect(await cache.sync()).toEqual({ state: "ready", version: t.version });
		expect(await cache.getLeagueLogos()).toEqual({
			LCK: "rift-asset://leagues/leagues/lck.png",
		});
		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("only serves verified league logos from the league origin", async () => {
		const goodUrl = "https://static.lolesports.com/leagues/lck.png";
		t.override = async (url) => {
			if (url.pathname.endsWith("/redirect.png"))
				return { ...response(png), status: 302 };
			return response(url.pathname.endsWith("/bad.png") ? jpeg : png);
		};
		const valid = {
			id: "LCK",
			url: goodUrl,
			sha256: createHash("sha256").update(png).digest("hex"),
			size: png.length,
			mime: "image/png",
		};
		const cache = create();
		const result = await cache.syncLeagueLogos([
			valid,
			{ ...valid, id: "Host", url: goodUrl.replace(".com", ".com.example") },
			{ ...valid, id: "Team", url: goodUrl.replace("/leagues/", "/teams/") },
			{ ...valid, id: "Svg", mime: "image/svg+xml" },
			{ ...valid, id: "Large", size: 512 * 1024 + 1 },
			{ ...valid, id: "Size", size: valid.size + 1 },
			{ ...valid, id: "Digest", sha256: "0".repeat(64) },
			{
				...valid,
				id: "Redirect",
				url: goodUrl.replace("lck.png", "redirect.png"),
			},
			{
				...valid,
				id: "Magic",
				url: goodUrl.replace("lck.png", "bad.png"),
				size: jpeg.length,
				sha256: createHash("sha256").update(jpeg).digest("hex"),
			},
		]);
		expect(result.failed).toEqual([
			"Host",
			"Team",
			"Svg",
			"Large",
			"Size",
			"Digest",
			"Redirect",
			"Magic",
		]);
		const url = "rift-asset://leagues/leagues/lck.png";
		expect(await cache.getLeagueLogos()).toEqual({ LCK: url });
		const served = await serveAsset(t.profile, { url, method: "GET" });
		expect(served.headers.get("content-type")).toBe("image/png");
		expect(Buffer.from(await served.arrayBuffer())).toEqual(png);
		await writeFile(join(t.profile, "assets/leagues/leagues/lck.png"), jpeg);
		expect((await serveAsset(t.profile, { url, method: "GET" })).status).toBe(
			404,
		);
		expect(await cache.getLeagueLogos()).toEqual({});
	});

	it("A3 downloads team logos under their slug and lists their protocol URLs", async () => {
		const logo = Buffer.concat([png, Buffer.from("logo")]);
		const logoUrl = "https://static.lolesports.com/teams/A.png";
		t.override = async (url) =>
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
		const served = await serveAsset(t.profile, {
			url: "rift-asset://logos/teams/gen-g.png",
			method: "GET",
		});
		expect(Buffer.from(await served.arrayBuffer())).toEqual(logo);
	});
});
