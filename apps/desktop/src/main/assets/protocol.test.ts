import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { serveAsset } from "./protocol";

let profile: string;
let active: string;

beforeEach(async () => {
	profile = await mkdtemp(join(tmpdir(), "rift-assets-protocol-"));
	const source = join(profile, "assets", "cdragon");
	active = join(source, "1.2");
	await mkdir(join(active, "img"), { recursive: true });
	await writeFile(join(source, "current.json"), '{"version":"1.2"}');
	await writeFile(join(active, "img", "A.png"), "cached image bytes");
	await writeFile(join(active, "catalog.json"), '{"active":true}');
});

afterEach(async () => {
	await rm(profile, { recursive: true, force: true });
});

function get(url: string, method = "GET") {
	return serveAsset(profile, { url: `rift-asset://${url}`, method });
}

test("serves PNG and JSON from the active version with their MIME types", async () => {
	const image = await get("cdragon/img/%41.png");
	expect(image.status).toBe(200);
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(await image.text()).toBe("cached image bytes");
	const data = await get("cdragon/catalog.json");
	expect(data.status).toBe(200);
	expect(data.headers.get("content-type")).toBe("application/json");
	expect(await data.json()).toEqual({ active: true });
});

test("serves SVG as an image that cannot load anything else", async () => {
	await mkdir(join(active, "stats"));
	await writeFile(join(active, "stats", "gold.svg"), "<svg></svg>");
	const image = await get("cdragon/stats/gold.svg");
	expect(image.status).toBe(200);
	expect(image.headers.get("content-type")).toBe("image/svg+xml");
	expect(image.headers.get("content-security-policy")).toBe(
		"default-src 'none'",
	);
	expect(await image.text()).toBe("<svg></svg>");
});

test("reads the active pointer for each request", async () => {
	const source = join(profile, "assets", "cdragon");
	await mkdir(join(source, "2.0"), { recursive: true });
	await writeFile(join(source, "2.0", "catalog.json"), "2");
	await writeFile(join(source, "current.json"), '{"version":"2.0"}');
	expect(await (await get("cdragon/catalog.json")).json()).toBe(2);
	await mkdir(join(source, "3.0"));
	await writeFile(join(source, "3.0", "catalog.json"), "3");
	await writeFile(join(source, "current.json"), '{"version":"3.0"}');
	expect(await (await get("cdragon/catalog.json")).json()).toBe(3);
});

test.each([
	"cdragon/img/../catalog.json",
	"cdragon/img/%2e%2E/catalog.json",
	"cdragon/img/.%2E/catalog.json",
	"cdragon/img%2fA.png",
	"cdragon/img%5cA.png",
	"cdragon/img\\A.png",
	"cdragon//img/A.png",
	"cdragon/%2fimg/A.png",
	"cdragon/C:/img/A.png",
	"cdragon/%00.png",
	"cdragon/%.png",
	"cdragon/img",
	"cdragon/img/Missing.png",
	"cdragon/1.2/catalog.json",
	"cdragon/current.json",
	"unknown/catalog.json",
	"ddragon/catalog.json",
	"cdragon:80/catalog.json",
	"user@cdragon/catalog.json",
])("returns 404 for %s", async (url) => {
	expect((await get(url)).status).toBe(404);
});

test.each(["POST", "HEAD", "DELETE"])("returns 404 for %s", async (method) => {
	expect((await get("cdragon/catalog.json", method)).status).toBe(404);
});

test("rejects a directory with an asset extension and a corrupt pointer", async () => {
	await mkdir(join(active, "directory.png"));
	expect((await get("cdragon/directory.png")).status).toBe(404);
	await writeFile(join(active, "..", "current.json"), '{"version":"../1.2"}');
	expect((await get("cdragon/catalog.json")).status).toBe(404);
});

test("rejects symlinks to directories outside the version, including the version root", async () => {
	const outside = join(profile, "outside");
	await mkdir(outside);
	await writeFile(join(outside, "private.json"), "{}");
	await symlink(outside, join(active, "linked"), "junction");
	expect((await get("cdragon/linked/private.json")).status).toBe(404);
	await rm(active, { recursive: true });
	await symlink(outside, active, "junction");
	expect((await get("cdragon/private.json")).status).toBe(404);
});

test.skipIf(process.platform === "win32")(
	"rejects a symlink to an external file",
	async () => {
		const outside = join(profile, "private.json");
		await writeFile(outside, "{}");
		await symlink(outside, join(active, "linked.json"));
		expect((await get("cdragon/linked.json")).status).toBe(404);
	},
);

// Electron hands the handler a Request whose URL is already normalized.
test.each([
	"rift-asset://cdragon/img/../../current.json",
	"rift-asset://cdragon/img/%2e%2e/%2e%2e/current.json",
	"rift-asset://cdragon/img/%252e%252e/catalog.json",
	"rift-asset://cdragon/%252e%252e/%252e%252e/current.json",
	"rift-asset://cdragon/img/..%5c..%5ccurrent.json",
	"rift-asset://cdragon/img/%5c..%5ccatalog.json",
	"rift-asset://cdragon/../ddragon/catalog.json",
	"rift-asset://cdragon/%2e%2e/1.2/catalog.json",
])("a real Request for %s never leaves the active version", async (raw) => {
	const request = new Request(raw);
	const response = await serveAsset(profile, request);
	expect(response.status).toBe(404);
});

test("a normalized Request stays inside the active version", async () => {
	const request = new Request("rift-asset://cdragon/img/../catalog.json");
	expect(request.url).toBe("rift-asset://cdragon/catalog.json");
	expect((await serveAsset(profile, request)).status).toBe(200);
});

describe("team logos", () => {
	const png = Buffer.concat([
		Buffer.from("89504e470d0a1a0a", "hex"),
		Buffer.from("logo"),
	]);
	const sha256 = createHash("sha256").update(png).digest("hex");
	let source: string;

	beforeEach(async () => {
		source = join(profile, "assets", "logos");
		await mkdir(join(source, "teams"), { recursive: true });
		await writeFile(join(source, "teams", "gen-g.png"), png);
		await writeFile(
			join(source, "manifest.json"),
			JSON.stringify({
				teams: {
					"Gen.G": { path: "teams/gen-g.png", size: png.length, sha256 },
				},
			}),
		);
	});

	test("serves a manifest-listed logo with its type and no sniffing", async () => {
		const response = await get("logos/teams/gen-g.png");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
	});

	test.each([
		"logos/teams/other.png",
		"logos/teams/gen-g.svg",
		"logos/teams/gen-g.jpg",
		"logos/teams/Gen-G.png",
		"logos/teams/../manifest.json",
		"logos/teams/%2e%2e/manifest.json",
		"logos/teams%2fgen-g.png",
		"logos/manifest.json",
		"logos/teams/gen-g.png/x",
		"logos//teams/gen-g.png",
	])("returns 404 for %s", async (url) => {
		expect((await get(url)).status).toBe(404);
	});

	test("returns 404 when the file no longer matches the manifest digest", async () => {
		await writeFile(join(source, "teams", "gen-g.png"), "<svg onload=x>");
		expect((await get("logos/teams/gen-g.png")).status).toBe(404);
	});

	test("returns 404 when there is no manifest", async () => {
		await rm(join(source, "manifest.json"));
		expect((await get("logos/teams/gen-g.png")).status).toBe(404);
	});
});
