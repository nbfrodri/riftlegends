import * as fs from "node:fs/promises";
import { readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jpeg, useCacheFixture } from "./cache-test-kit";

// Windows lets an antivirus or the search indexer hold a file it has just seen,
// so a rename or delete there fails for a moment with EPERM, EACCES or EBUSY.
// Each path is held once: the first rename or recursive delete touching it fails.
const held = vi.hoisted(() => ({ on: false, seen: new Set<string>() }));
vi.mock("node:fs/promises", async (importOriginal) => {
	const original = await importOriginal<typeof fs>();
	const hold = (path: unknown, code: string) => {
		const key = String(path);
		if (!held.on || held.seen.has(key)) return;
		held.seen.add(key);
		throw Object.assign(new Error(`${code}: held by a scanner, ${key}`), {
			code,
		});
	};
	return {
		...original,
		rename: vi.fn(async (from: string, to: string) => {
			hold(from, "EPERM");
			return original.rename(from, to);
		}),
		rm: vi.fn(async (path: string, options?: Parameters<typeof fs.rm>[1]) => {
			if (options?.recursive) hold(path, "EBUSY");
			return original.rm(path, options);
		}),
	};
});

describe("#549: the champion cache on Windows", () => {
	const t = useCacheFixture();
	const { create, source } = t;
	const platform = Object.getOwnPropertyDescriptor(process, "platform");

	beforeEach(() => {
		Object.defineProperty(process, "platform", { value: "win32" });
		held.seen.clear();
	});
	afterEach(() => {
		held.on = false;
		if (platform) Object.defineProperty(process, "platform", platform);
	});

	it("finishes a first download although new files are held for a moment", async () => {
		held.on = true;
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(await readFile(source(t.version, "splashes", "Ahri.jpg"))).toEqual(
			jpeg,
		);
	});

	it("completes a cache made before splashes while its files are held", async () => {
		await create().sync();
		const manifestPath = source(t.version, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		delete manifest.files["splashes/Ahri.jpg"];
		delete manifest.splashes;
		await rm(source(t.version, "splashes"), { recursive: true });
		await writeFile(manifestPath, JSON.stringify(manifest));

		held.on = true;
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(await readFile(source(t.version, "splashes", "Ahri.jpg"))).toEqual(
			jpeg,
		);
	});
});
