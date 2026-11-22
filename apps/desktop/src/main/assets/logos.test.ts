import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	logoFile,
	readTeamLogos,
	sniffImage,
	syncTeamLogos,
	teamLogoSlugs,
} from "./logos";
import type { AssetTransport } from "./transport";

const png = Buffer.concat([
	Buffer.from("89504e470d0a1a0a", "hex"),
	Buffer.from("logo"),
]);
const jpeg = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.from("x")]);
const webp = Buffer.concat([
	Buffer.from("RIFF"),
	Buffer.from([4, 0, 0, 0]),
	Buffer.from("WEBPVP8 "),
]);
const sha256 = (bytes: Buffer) =>
	createHash("sha256").update(bytes).digest("hex");
const urlOf = (name: string) => `https://static.lolesports.com/teams/${name}`;

function source(id: string, bytes = png, mime = "image/png", name = "A.png") {
	return {
		id,
		url: urlOf(name),
		sha256: sha256(bytes),
		size: bytes.length,
		mime,
	};
}

describe("sniffImage", () => {
	it("recognises PNG, JPEG and WebP by magic bytes", () => {
		expect(sniffImage(png)).toBe("png");
		expect(sniffImage(jpeg)).toBe("jpg");
		expect(sniffImage(webp)).toBe("webp");
	});
	it.each([
		["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
		["HTML", Buffer.from("<!DOCTYPE html>")],
		["GIF", Buffer.from("GIF89a....")],
		[
			"RIFF that is not WebP",
			Buffer.concat([
				Buffer.from("RIFF"),
				Buffer.from([4, 0, 0, 0]),
				Buffer.from("WAVEfmt "),
			]),
		],
		["empty", Buffer.alloc(0)],
	])("rejects %s", (_name, bytes) => {
		expect(sniffImage(bytes)).toBeUndefined();
	});
});

describe("teamLogoSlugs", () => {
	it("maps team ids to strict slugs, never empty or unsafe", () => {
		const slugs = teamLogoSlugs([
			"Gen.G",
			"BNK FEARX",
			"LØS",
			"Anyone's Legend",
			"../../x",
			"CON",
		]);
		for (const slug of slugs.values())
			expect(slug).toMatch(/^[a-z0-9-]{1,64}$/);
		expect(slugs.get("Gen.G")).toBe("gen-g");
		expect(slugs.get("BNK FEARX")).toBe("bnk-fearx");
		expect(slugs.get("Anyone's Legend")).toBe("anyone-s-legend");
		expect(slugs.get("CON")).not.toBe("con");
		expect(new Set(slugs.values()).size).toBe(slugs.size);
	});
	it("keeps colliding ids apart, whatever the order or the other teams", () => {
		const a = teamLogoSlugs(["Gen.G", "Gen G", "Other"]);
		const b = teamLogoSlugs(["Gen G", "Other", "Gen.G"]);
		expect(a.get("Gen.G")).not.toBe(a.get("Gen G"));
		expect(a.get("Gen.G")).toBe(b.get("Gen.G"));
		expect(a.get("Gen G")).toBe(b.get("Gen G"));
	});
	it("caps long ids and survives ids with no usable characters", () => {
		const slugs = teamLogoSlugs(["x".repeat(500), "日本語", "ØØ"]);
		expect([...slugs.values()].every((s) => /^[a-z0-9-]{1,64}$/.test(s))).toBe(
			true,
		);
		expect(new Set(slugs.values()).size).toBe(3);
	});
});

describe("logoFile", () => {
	it("derives the local path from the slug and mime, not the remote name", () => {
		const file = logoFile(
			"gen-g",
			source("Gen.G", png, "image/png", "../evil.png"),
		);
		expect(file).toBeUndefined();
		const ok = logoFile("gen-g", source("Gen.G"));
		expect(ok?.path).toBe("teams/gen-g.png");
		expect(ok?.url.host).toBe("static.lolesports.com");
	});
	it.each([
		[
			"another host",
			urlOf("A.png").replace("static.lolesports", "evil.example"),
		],
		["http", urlOf("A.png").replace("https", "http")],
		[
			"a Fandom image",
			"https://static.wikia.nocookie.net/x/images/6/67/A.png/revision/latest",
		],
		["a query", `${urlOf("A.png")}?x=1`],
	])("rejects %s", (_name, url) => {
		expect(logoFile("a", { ...source("A"), url })).toBeUndefined();
	});
	it.each(["image/svg+xml", "image/gif", "text/html", "image/png; x"])(
		"rejects mime %s",
		(mime) => {
			expect(logoFile("a", { ...source("A"), mime })).toBeUndefined();
		},
	);
	it("rejects a malformed digest and an invalid size", () => {
		expect(logoFile("a", { ...source("A"), sha256: "zz" })).toBeUndefined();
		expect(logoFile("a", { ...source("A"), size: 0 })).toBeUndefined();
		expect(
			logoFile("a", { ...source("A"), size: 512 * 1024 + 1 }),
		).toBeUndefined();
	});
	it("checks SHA-256, size, magic bytes and agreement with the declared type", () => {
		const file = logoFile("a", source("A"));
		expect(file?.check?.(png)).toBe(true);
		expect(file?.check?.(Buffer.concat([png, Buffer.from("!")]))).toBe(false);
		const svg = Buffer.from("<svg onload=alert(1)></svg>");
		const lying = logoFile("a", source("A", svg));
		expect(lying?.check?.(svg)).toBe(false);
		const jpegAsPng = logoFile("a", source("A", jpeg));
		expect(jpegAsPng?.check?.(jpeg)).toBe(false);
		const wrongSize = logoFile("a", { ...source("A"), size: png.length + 1 });
		expect(wrongSize?.check?.(png)).toBe(false);
	});
});

describe("syncTeamLogos", () => {
	let root: string;
	let requests: URL[];
	let bodies: Map<string, Buffer>;
	const transport: AssetTransport = async (url) => {
		requests.push(url);
		const bytes = bodies.get(url.pathname.split("/").at(-1) ?? "");
		if (!bytes)
			return { status: 404, headers: {}, body: (async function* () {})() };
		return {
			status: 200,
			headers: { "content-length": String(bytes.length) },
			body: (async function* () {
				yield bytes;
			})(),
		};
	};
	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "rift-logos-"));
		requests = [];
		bodies = new Map();
	});
	afterEach(() => rm(root, { recursive: true, force: true }));

	it("downloads verified logos and lists them under their slug", async () => {
		bodies.set("A.png", png);
		const result = await syncTeamLogos(
			root,
			[source("Gen.G", png, "image/png", "A.png")],
			transport,
		);
		expect(result.failed).toEqual([]);
		expect(await readFile(join(root, "teams", "gen-g.png"))).toEqual(png);
		expect(await readTeamLogos(root)).toEqual({ "Gen.G": "teams/gen-g.png" });
	});

	it("rejects a SHA-256 mismatch and keeps going", async () => {
		bodies.set("A.png", png);
		bodies.set("B.png", Buffer.concat([png, Buffer.from("tampered")]));
		const result = await syncTeamLogos(
			root,
			[
				source("Bad", png, "image/png", "B.png"),
				source("Good", png, "image/png", "A.png"),
			],
			transport,
		);
		expect(result.failed).toEqual(["Bad"]);
		expect(await readTeamLogos(root)).toEqual({ Good: "teams/good.png" });
	});

	it("rejects SVG served under a PNG name, even with a matching hash", async () => {
		const svg = Buffer.from("<svg><script>alert(1)</script></svg>");
		bodies.set("A.svg", svg);
		const result = await syncTeamLogos(
			root,
			[{ ...source("S", svg, "image/png", "A.svg") }],
			transport,
		);
		expect(result.failed).toEqual(["S"]);
		expect(await readTeamLogos(root)).toEqual({});
	});

	it("rejects oversized logos and disallowed URLs without fetching them", async () => {
		const big = Buffer.concat([png, Buffer.alloc(600 * 1024)]);
		bodies.set("A.png", big);
		const evil = { ...source("Evil"), url: "https://evil.example/x.png" };
		const result = await syncTeamLogos(
			root,
			[source("Big", big, "image/png", "A.png"), evil],
			transport,
		);
		expect(result.failed.sort()).toEqual(["Big", "Evil"]);
		expect(requests.every((url) => url.host === "static.lolesports.com")).toBe(
			true,
		);
	});

	it("treats a redirect as a failure instead of following it", async () => {
		const redirecting: AssetTransport = async () => ({
			status: 302,
			headers: { location: "https://evil.example/x.png" },
			body: (async function* () {})(),
		});
		const result = await syncTeamLogos(root, [source("R")], redirecting);
		expect(result.failed).toEqual(["R"]);
	});

	it("does not download again when the SHA-256 is unchanged, and replaces a changed logo", async () => {
		bodies.set("A.png", png);
		const first = source("T", png, "image/png", "A.png");
		await syncTeamLogos(root, [first], transport);
		await syncTeamLogos(root, [first], transport);
		expect(requests).toHaveLength(1);
		const next = Buffer.concat([png, Buffer.from("v2")]);
		bodies.set("A.png", next);
		await syncTeamLogos(
			root,
			[source("T", next, "image/png", "A.png")],
			transport,
		);
		expect(requests).toHaveLength(2);
		expect(await readFile(join(root, "teams", "t.png"))).toEqual(next);
	});

	it("drops a logo whose file no longer matches the manifest", async () => {
		bodies.set("A.png", png);
		await syncTeamLogos(
			root,
			[source("T", png, "image/png", "A.png")],
			transport,
		);
		const { writeFile } = await import("node:fs/promises");
		await writeFile(join(root, "teams", "t.png"), "corrupted");
		expect(await readTeamLogos(root)).toEqual({});
	});

	it("stops quietly when the network is unavailable, keeping earlier logos", async () => {
		bodies.set("A.png", png);
		await syncTeamLogos(
			root,
			[source("Old", png, "image/png", "A.png")],
			transport,
		);
		const offline: AssetTransport = async () => {
			throw Object.assign(new Error("down"), { code: "ENETUNREACH" });
		};
		const result = await syncTeamLogos(
			root,
			[
				source("Old", png, "image/png", "A.png"),
				source("New", png, "image/png", "B.png"),
			],
			offline,
		);
		expect(result.failed).toEqual([]);
		expect(await readTeamLogos(root)).toEqual({ Old: "teams/old.png" });
	});
});
