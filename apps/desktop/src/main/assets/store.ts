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
	championDataFile,
	championSummaryFile,
	communityFiles,
	isRecord,
	isVersion,
	maxCatalogBytes,
	maxChampionDataBytes,
	maxImageBytes,
	mergeChampionCatalogs,
	parseChampionSummary,
	portraitFile,
	tileFile,
	tilePath,
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
// Room for an icon and a tile per champion, up to maxAssetChampions.
const manifestLimit = 512 * 1024;
const locales = ["en", "es"] as const;

interface VerifiedCatalog {
	catalog: ChampionCatalog;
	/** False for a cache made before champion tiles (#367). */
	tiles: boolean;
}

async function verifyCatalog(
	root: string,
	version: string,
): Promise<VerifiedCatalog | undefined> {
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
	const required = [
		...communityFiles,
		...english.map((champion) => portraitFile(version, champion)),
	];
	// A champion's tile is optional: the UI falls back to its icon.
	const limits = new Map([
		...locales.map((locale) => [catalogPath(locale), maxCatalogBytes] as const),
		...required.map(({ path, limit }) => [path, limit] as const),
		...english.map((champion) => [tilePath(champion), maxImageBytes] as const),
	]);
	if (required.some(({ path }) => !Object.hasOwn(digests, path)))
		return undefined;
	for (const path of Object.keys(digests)) {
		const limit = limits.get(path);
		if (!limit || !(await verifyFile(path, limit))) return undefined;
	}
	return { catalog, tiles: manifest.tiles === true };
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
		const verified = await verifyCatalog(join(root, version), version);
		return verified && { version, ...verified };
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
	if (existing?.tiles) return existing.catalog;
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
	total = completed + images.length + localized.en.length;
	progress(completed, total);
	for (const file of images) {
		manifest[file.path] = await downloadFile(stageRoot, file, transport);
		progress(++completed, total);
	}
	for (const champion of localized.en) {
		const tile = await downloadTile(stageRoot, version, champion, transport);
		if (tile) manifest[tilePath(champion)] = tile;
		progress(++completed, total);
	}
	await writeJson(staging, { version, tiles: true, files: manifest });
	const verified = await verifyCatalog(stageRoot, version);
	if (!verified) throw new Error("Staged assets failed verification");
	await rm(join(stageRoot, "upstream"), { recursive: true, force: true });
	await rm(target, { recursive: true, force: true });
	await rename(stageRoot, target);
	await syncDirectory(root);
	return verified.catalog;
}

/** Missing or unexpected champion data leaves the champion with its icon. */
async function downloadTile(
	stageRoot: string,
	version: string,
	champion: LocalizedChampionAsset,
	transport: AssetTransport,
): Promise<Digest | undefined> {
	const missing = (error: unknown) => {
		if (error instanceof AssetHttpError && error.status === 404)
			return undefined;
		throw error;
	};
	const data = championDataFile(version, champion);
	if (!(await downloadFile(stageRoot, data, transport).catch(missing)))
		return undefined;
	const file = tileFile(
		version,
		champion,
		await readJson(await cachePath(stageRoot, data.path), maxChampionDataBytes),
	);
	return file && downloadFile(stageRoot, file, transport).catch(missing);
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
