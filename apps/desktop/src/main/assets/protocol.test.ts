import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { serveAsset } from "./protocol";

let profile: string;
let active: string;

beforeEach(async () => {
	profile = await mkdtemp(join(tmpdir(), "rift-assets-protocol-"));
	const source = join(profile, "assets", "ddragon");
	active = join(source, "1.2.3");
	await mkdir(join(active, "img"), { recursive: true });
	await writeFile(join(source, "current.json"), '{"version":"1.2.3"}');
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
	const image = await get("ddragon/img/%41.png");
	expect(image.status).toBe(200);
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(await image.text()).toBe("cached image bytes");
	const data = await get("ddragon/catalog.json");
	expect(data.status).toBe(200);
	expect(data.headers.get("content-type")).toBe("application/json");
	expect(await data.json()).toEqual({ active: true });
});

test("uses the active pointer of the requested source for each read", async () => {
	const source = join(profile, "assets", "cdragon");
	await mkdir(join(source, "2.0.0"), { recursive: true });
	await writeFile(join(source, "2.0.0", "catalog.json"), "2");
	await writeFile(join(source, "current.json"), '{"version":"2.0.0"}');
	expect(await (await get("cdragon/catalog.json")).json()).toBe(2);
	await mkdir(join(source, "3.0.0"));
	await writeFile(join(source, "3.0.0", "catalog.json"), "3");
	await writeFile(join(source, "current.json"), '{"version":"3.0.0"}');
	expect(await (await get("cdragon/catalog.json")).json()).toBe(3);
});

test.each([
	"ddragon/img/../catalog.json",
	"ddragon/img/%2e%2E/catalog.json",
	"ddragon/img/.%2E/catalog.json",
	"ddragon/img%2fA.png",
	"ddragon/img%5cA.png",
	"ddragon/img\\A.png",
	"ddragon//img/A.png",
	"ddragon/%2fimg/A.png",
	"ddragon/C:/img/A.png",
	"ddragon/%00.png",
	"ddragon/%.png",
	"ddragon/img",
	"ddragon/img/Missing.png",
	"ddragon/1.2.3/catalog.json",
	"ddragon/current.json",
	"unknown/catalog.json",
	"ddragon:80/catalog.json",
	"user@ddragon/catalog.json",
])("returns 404 for %s", async (url) => {
	expect((await get(url)).status).toBe(404);
});

test.each(["POST", "HEAD", "DELETE"])("returns 404 for %s", async (method) => {
	expect((await get("ddragon/catalog.json", method)).status).toBe(404);
});

test("rejects a directory with an asset extension and a corrupt pointer", async () => {
	await mkdir(join(active, "directory.png"));
	expect((await get("ddragon/directory.png")).status).toBe(404);
	await writeFile(join(active, "..", "current.json"), '{"version":"../1.2.3"}');
	expect((await get("ddragon/catalog.json")).status).toBe(404);
});

test("rejects symlinks to directories outside the version, including the version root", async () => {
	const outside = join(profile, "outside");
	await mkdir(outside);
	await writeFile(join(outside, "private.json"), "{}");
	await symlink(outside, join(active, "linked"), "junction");
	expect((await get("ddragon/linked/private.json")).status).toBe(404);
	await rm(active, { recursive: true });
	await symlink(outside, active, "junction");
	expect((await get("ddragon/private.json")).status).toBe(404);
});

test.skipIf(process.platform === "win32")(
	"rejects a symlink to an external file",
	async () => {
		const outside = join(profile, "private.json");
		await writeFile(outside, "{}");
		await symlink(outside, join(active, "linked.json"));
		expect((await get("ddragon/linked.json")).status).toBe(404);
	},
);

// Electron hands the handler a Request whose URL is already normalized.
test.each([
	"rift-asset://ddragon/img/../../current.json",
	"rift-asset://ddragon/img/%2e%2e/%2e%2e/current.json",
	"rift-asset://ddragon/img/%252e%252e/catalog.json",
	"rift-asset://ddragon/%252e%252e/%252e%252e/current.json",
	"rift-asset://ddragon/img/..%5c..%5ccurrent.json",
	"rift-asset://ddragon/img/%5c..%5ccatalog.json",
	"rift-asset://ddragon/../cdragon/catalog.json",
	"rift-asset://ddragon/%2e%2e/1.2.3/catalog.json",
])("a real Request for %s never leaves the active version", async (raw) => {
	const request = new Request(raw);
	const response = await serveAsset(profile, request);
	expect(response.status).toBe(404);
});

test("a normalized Request stays inside the active version", async () => {
	const request = new Request("rift-asset://ddragon/img/../catalog.json");
	expect(request.url).toBe("rift-asset://ddragon/catalog.json");
	expect((await serveAsset(profile, request)).status).toBe(200);
});
