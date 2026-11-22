import { describe, expect, it } from "vitest";
import {
	parseRiotLogoUrl,
	realLogosSchema,
	sniffImageMime,
} from "../draft/real-logos";

const good = "https://static.lolesports.com/teams/1631819564399_hle-2021.png";
const akamai =
	"https://lolstatic-a.akamaihd.net/esports-assets/production/team/tbd-awibzy0k.png";
const sha256 = "a".repeat(64);
const entry = {
	team: "T1",
	url: good,
	sha256,
	size: 10,
	mime: "image/png",
};
const file = {
	provenance: {
		source: "lolesports.com",
		endpoint:
			"https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-US",
		retrievedAt: "2026-11-22T12:00:00.000Z",
		note: "x",
	},
	logos: [entry],
};

describe("parseRiotLogoUrl", () => {
	it("accepts the two Riot logo hosts over https", () => {
		expect(parseRiotLogoUrl(good)).toBeInstanceOf(URL);
		expect(parseRiotLogoUrl(akamai)).toBeInstanceOf(URL);
		expect(
			parseRiotLogoUrl("https://static.lolesports.com/teams/a%20b_(1).WEBP"),
		).toBeDefined();
	});
	it.each([
		["http", good.replace("https", "http")],
		["svg", good.replace(".png", ".svg")],
		["another host", good.replace("static.lolesports.com", "evil.example")],
		[
			"a look-alike host",
			good.replace("static.lolesports.com", "static.lolesports.com.evil.io"),
		],
		["credentials", good.replace("https://", "https://u:p@")],
		["a port", good.replace(".com", ".com:8443")],
		["a query", `${good}?x=1`],
		["a fragment", `${good}#x`],
		["traversal", "https://static.lolesports.com/teams/%2e%2e/a.png"],
		["a nested path", "https://static.lolesports.com/teams/a/b.png"],
		["a wrong prefix on akamai", akamai.replace("/team/", "/other/")],
		[
			"the wrong prefix for the host",
			akamai.replace(
				"lolstatic-a.akamaihd.net/esports-assets/production/team",
				"static.lolesports.com/team",
			),
		],
		["garbage", "nope"],
	])("rejects %s", (_name, value) => {
		expect(parseRiotLogoUrl(value)).toBeUndefined();
	});
});

describe("realLogosSchema", () => {
	it("accepts a valid file", () => {
		expect(realLogosSchema.safeParse(file).success).toBe(true);
	});
	it.each([
		["a bad digest", { ...entry, sha256: "xyz" }],
		["a bad host", { ...entry, url: "https://evil.example/teams/a.png" }],
		["an svg mime", { ...entry, mime: "image/svg+xml" }],
		["a zero size", { ...entry, size: 0 }],
		["an extra key", { ...entry, extra: 1 }],
	])("rejects %s", (_name, bad) => {
		expect(realLogosSchema.safeParse({ ...file, logos: [bad] }).success).toBe(
			false,
		);
	});
	it("rejects duplicated teams", () => {
		expect(
			realLogosSchema.safeParse({ ...file, logos: [entry, entry] }).success,
		).toBe(false);
	});
});

describe("sniffImageMime", () => {
	const bytes = (...values: number[]) => Uint8Array.from(values);
	it("recognises PNG, JPEG and WebP by magic bytes", () => {
		expect(
			sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
		).toBe("image/png");
		expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
		expect(sniffImageMime(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe(
			"image/webp",
		);
	});
	it("rejects SVG, HTML and short input", () => {
		expect(
			sniffImageMime(Buffer.from("<svg xmlns='x'></svg>")),
		).toBeUndefined();
		expect(sniffImageMime(Buffer.from("<!doctype html>"))).toBeUndefined();
		expect(sniffImageMime(bytes(0x89, 0x50))).toBeUndefined();
		expect(sniffImageMime(bytes())).toBeUndefined();
	});
});
