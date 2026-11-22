import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	type AssetFile,
	championCatalogs,
	communityFiles,
	dataDragonFiles,
	isRecord,
	isVersion,
	maxCatalogBytes,
	portraitPaths,
} from "./catalog";
import {
	cachePath,
	type Digest,
	isDigest,
	matches,
	readJson,
	statIfPresent,
	syncDirectory,
	writeJson,
} from "./disk";
import { downloadFile } from "./download";
import type { AssetTransport } from "./transport";

type Source = "ddragon" | "cdragon";
type Progress = (completed: number, total: number) => void;
const manifestLimit = 128 * 1024;

async function getPortraits(
	root: string,
	version: string,
): Promise<AssetFile[]> {
	const [spanish, english] = await Promise.all(
		championCatalogs.map(async (path) =>
			portraitPaths(
				await readJson(await cachePath(root, path), maxCatalogBytes),
			),
		),
	);
	if (
		!spanish ||
		!english ||
		spanish.length !== english.length ||
		spanish.some((path, index) => path !== english[index])
	) {
		throw new Error("Champion catalogs disagree");
	}
	return dataDragonFiles(version, english);
}

async function verifies(
	root: string,
	source: Source,
	version: string,
): Promise<boolean> {
	const manifest = await readJson(join(root, "manifest.json"), manifestLimit);
	if (
		!isRecord(manifest) ||
		manifest.version !== version ||
		!isRecord(manifest.files)
	)
		return false;
	const files =
		source === "ddragon"
			? [
					...dataDragonFiles(version, championCatalogs),
					...(await getPortraits(root, version)),
				]
			: communityFiles;
	if (Object.keys(manifest.files).length !== files.length) return false;
	for (const { path, limit } of files) {
		const digest = manifest.files[path];
		if (
			!isDigest(digest) ||
			!(await matches(await cachePath(root, path), digest, limit))
		)
			return false;
	}
	return true;
}

export async function verifiesVersion(
	root: string,
	source: Source,
	version: string,
): Promise<boolean> {
	const directory = join(root, version);
	try {
		return (
			(await statIfPresent(directory))?.isDirectory() === true &&
			(await verifies(directory, source, version))
		);
	} catch {
		return false;
	}
}

export async function readActiveVersion(
	pointer: string,
): Promise<string | undefined> {
	const current = await readJson(pointer, 256);
	return isRecord(current) && isVersion(current.version)
		? current.version
		: undefined;
}

export async function activeVersion(
	root: string,
	source: Source,
): Promise<string | undefined> {
	try {
		const version = await readActiveVersion(join(root, "current.json"));
		if (version && (await verifiesVersion(root, source, version)))
			return version;
	} catch {
		// The active cache can be absent, unreadable, or damaged on disk.
	}
	return undefined;
}

export async function prepareVersion(
	root: string,
	source: Source,
	version: string,
	transport: AssetTransport,
	progress: Progress,
): Promise<void> {
	const target = join(root, version);
	if (await verifiesVersion(root, source, version)) return;
	const staging = await cachePath(
		root,
		`staging-${version}/manifest.json`,
		true,
	);
	const stageRoot = join(root, `staging-${version}`);
	const manifest: Record<string, Digest> = {};
	const files =
		source === "ddragon"
			? dataDragonFiles(version, championCatalogs)
			: communityFiles;
	let completed = 0;
	let total = files.length;
	progress(completed, total);
	for (const file of files) {
		manifest[file.path] = await downloadFile(stageRoot, file, transport);
		progress(++completed, total);
	}
	if (source === "ddragon") {
		const portraits = await getPortraits(stageRoot, version).catch(
			async (error) => {
				for (const path of championCatalogs) {
					await rm(await cachePath(stageRoot, path), { force: true });
				}
				throw error;
			},
		);
		total += portraits.length;
		progress(completed, total);
		for (const file of portraits) {
			manifest[file.path] = await downloadFile(stageRoot, file, transport);
			progress(++completed, total);
		}
	}
	await writeJson(staging, { version, files: manifest });
	if (!(await verifies(stageRoot, source, version)))
		throw new Error("Staged assets failed verification");
	await rm(target, { recursive: true, force: true });
	await rename(stageRoot, target);
	await syncDirectory(root);
}

export async function activateVersion(
	root: string,
	version: string,
): Promise<void> {
	await writeJson(join(root, "current.json"), { version });
	await syncDirectory(root);
}

export async function pruneVersions(
	root: string,
	current: string,
): Promise<void> {
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const version = entry.name.startsWith("staging-")
			? entry.name.slice(8)
			: entry.name;
		if (entry.isDirectory() && isVersion(version) && entry.name !== current) {
			await rm(join(root, entry.name), { recursive: true, force: true });
		}
	}
}
