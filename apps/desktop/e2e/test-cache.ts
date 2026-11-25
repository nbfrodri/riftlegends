import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import champions from "../../../packages/core/content/real/champions/champions.json";
import {
	catalogPath,
	communityFiles,
	portraitFile,
} from "../src/main/assets/catalog";

/** Installs an offline catalog with generated placeholders in an isolated profile. */
export async function installTestCache(profile: string) {
	const version = "16.23";
	const source = join(profile, "assets", "cdragon");
	const entries = champions.map(({ id }, i) => ({
		id,
		key: i + 1,
		name: id,
		title: id,
		classes: ["fighter" as const],
	}));
	const files: Record<string, { size: number; sha256: string }> = {};
	async function file(path: string, bytes: Buffer) {
		const target = join(source, version, path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, bytes);
		files[path] = {
			size: bytes.length,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
	}
	const pixel = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
		"base64",
	);
	for (const locale of ["en", "es"] as const)
		await file(catalogPath(locale), Buffer.from(JSON.stringify(entries)));
	for (const entry of entries)
		await file(portraitFile(version, entry).path, pixel);
	for (const { path } of communityFiles)
		await file(
			path,
			path.endsWith(".svg")
				? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
				: pixel,
		);
	await writeFile(
		join(source, version, "manifest.json"),
		JSON.stringify({ version, files }),
	);
	await writeFile(join(source, "current.json"), JSON.stringify({ version }));
}
