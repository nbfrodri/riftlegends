import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	type ChampionCatalog,
	type LocalizedChampionAsset,
	localizedChampionCatalogSchema,
} from "@rift-legends/contracts";
import {
	type ChampionLocale,
	catalogPath,
	championSummaryFile,
	communityFiles,
	isRecord,
	isVersion,
	maxCatalogBytes,
	mergeChampionCatalogs,
	parseChampionSummary,
	portraitFile,
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
import { AssetHttpError, type AssetTransport } from "./transport";

type Progress = (completed: number, total: number) => void;
const manifestLimit = 128 * 1024;
const locales = ["en", "es"] as const;

async function verifyCatalog(
	root: string,
	version: string,
): Promise<ChampionCatalog | undefined> {
	if (!(await statIfPresent(root))?.isDirectory()) return undefined;
	const manifest = await readJson(
		await cachePath(root, "manifest.json"),
		manifestLimit,
	);
	if (
		!isRecord(manifest) ||
		manifest.version !== version ||
		!isRecord(manifest.files)
	)
		return undefined;
	const digests = manifest.files;
	async function verifyFile(path: string, limit: number) {
		const digest = digests[path];
		return (
			isDigest(digest) &&
			(await matches(await cachePath(root, path), digest, limit))
		);
	}
	async function readLocale(locale: ChampionLocale) {
		const path = catalogPath(locale);
		if (!(await verifyFile(path, maxCatalogBytes)))
			throw new Error("Invalid cached catalog digest");
		return localizedChampionCatalogSchema.parse(
			await readJson(await cachePath(root, path), maxCatalogBytes),
		);
	}
	const english = await readLocale("en");
	const spanish = await readLocale("es");
	const catalog = mergeChampionCatalogs(english, spanish);
	const images = [
		...communityFiles,
		...english.map((champion) => portraitFile(version, champion)),
	];
	if (Object.keys(digests).length !== images.length + locales.length)
		return undefined;
	for (const { path, limit } of images) {
		if (!(await verifyFile(path, limit))) return undefined;
	}
	return catalog;
}

export async function readActiveVersion(
	pointer: string,
): Promise<string | undefined> {
	const current = await readJson(pointer, 256);
	return isRecord(current) && isVersion(current.version)
		? current.version
		: undefined;
}

export async function activeCatalog(root: string) {
	try {
		const version = await readActiveVersion(
			await cachePath(root, "current.json"),
		);
		if (!version) return undefined;
		const catalog = await verifyCatalog(join(root, version), version);
		return catalog ? { version, catalog } : undefined;
	} catch {
		// The active cache can be absent, unreadable, or damaged on disk.
		return undefined;
	}
}

export async function prepareVersion(
	root: string,
	version: string,
	transport: AssetTransport,
	progress: Progress,
): Promise<ChampionCatalog | undefined> {
	const target = join(root, version);
	const existing = await verifyCatalog(target, version).catch(() => undefined);
	if (existing) return existing;
	const staging = await cachePath(
		root,
		`staging-${version}/manifest.json`,
		true,
	);
	const stageRoot = join(root, `staging-${version}`);
	const manifest: Record<string, Digest> = {};
	let completed = 0;
	let total = locales.length + communityFiles.length;
	progress(completed, total);

	const summaries = locales.map((locale) =>
		championSummaryFile(version, locale),
	);
	for (const file of summaries) {
		try {
			await downloadFile(stageRoot, file, transport);
		} catch (error) {
			if (error instanceof AssetHttpError && error.status === 404)
				return undefined;
			throw error;
		}
		progress(++completed, total);
	}

	async function parseSummary(locale: ChampionLocale) {
		const path = championSummaryFile(version, locale).path;
		return parseChampionSummary(
			await readJson(await cachePath(stageRoot, path), maxCatalogBytes),
		);
	}

	let localized: Record<ChampionLocale, LocalizedChampionAsset[]>;
	try {
		const english = await parseSummary("en");
		const spanish = await parseSummary("es");
		mergeChampionCatalogs(english, spanish);
		localized = { en: english, es: spanish };
	} catch (error) {
		// Download invalid catalogs again next time, even after a full transfer.
		for (const { path } of summaries)
			await rm(await cachePath(stageRoot, path), { force: true });
		throw error;
	}

	for (const locale of locales) {
		const path = catalogPath(locale);
		manifest[path] = await writeJson(
			await cachePath(stageRoot, path, true),
			localized[locale],
		);
	}
	const images = [
		...localized.en.map((champion) => portraitFile(version, champion)),
		...communityFiles,
	];
	total = completed + images.length;
	progress(completed, total);
	for (const file of images) {
		manifest[file.path] = await downloadFile(stageRoot, file, transport);
		progress(++completed, total);
	}
	await writeJson(staging, { version, files: manifest });
	const verified = await verifyCatalog(stageRoot, version);
	if (!verified) throw new Error("Staged assets failed verification");
	await rm(join(stageRoot, "upstream"), { recursive: true, force: true });
	await rm(target, { recursive: true, force: true });
	await rename(stageRoot, target);
	await syncDirectory(root);
	return verified;
}

export async function activateVersion(
	root: string,
	version: string,
): Promise<void> {
	await writeJson(await cachePath(root, "current.json"), { version });
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
