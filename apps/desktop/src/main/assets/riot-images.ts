import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { maxRiotImageBytes, sniffImageMime } from "@rift-legends/contracts";
import { type AssetFile, isRecord } from "./catalog";
import {
	cachePath,
	type Digest,
	isDigest,
	readBytes,
	readJson,
	writeJson,
} from "./disk";
import { downloadFile } from "./download";
import { type AssetTransport, NetworkUnavailable } from "./transport";

/** Metadata from an untrusted snapshot. Riot images are downloaded at runtime. */
export interface RiotImageSource {
	id: string;
	url: string;
	sha256: string;
	size: number;
	mime: string;
}

export type ImageFormat = "png" | "jpg" | "webp";
export const imageMimes: Record<ImageFormat, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp",
};
const formatByMime = new Map<string, ImageFormat>(
	(Object.entries(imageMimes) as [ImageFormat, string][]).map(
		([format, mime]) => [mime, format],
	),
);
const manifestLimit = 256 * 1024;
const reserved = /^(?:con|prn|aux|nul|com\d|lpt\d)$/;

export function sniffImage(bytes: Buffer): ImageFormat | undefined {
	const mime = sniffImageMime(bytes);
	return mime === undefined ? undefined : formatByMime.get(mime);
}

const digestOf = (id: string) =>
	createHash("sha256").update(id).digest("hex").slice(0, 8);

function baseSlug(id: string) {
	return id
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 55)
		.replace(/-+$/, "");
}

/** Colliding, reserved or empty slugs are disambiguated by hashing the id. */
export function imageSlugs(
	ids: readonly string[],
	emptySlug: string,
): Map<string, string> {
	const bases = new Map(ids.map((id) => [id, baseSlug(id)]));
	const counts = new Map<string, number>();
	for (const base of bases.values())
		counts.set(base, (counts.get(base) ?? 0) + 1);
	const slugs = new Map<string, string>();
	for (const [id, base] of bases) {
		const plain = base && (counts.get(base) ?? 0) === 1 && !reserved.test(base);
		slugs.set(id, plain ? base : `${base || emptySlug}-${digestOf(id)}`);
	}
	if (new Set(slugs.values()).size !== slugs.size)
		throw new Error("Riot image slugs collide");
	return slugs;
}

interface Entry extends Digest {
	path: string;
}

export function createRiotImageCache(
	folder: "teams" | "players",
	parseUrl: (value: string) => URL | undefined,
) {
	const imagePath = new RegExp(
		`^${folder}/[a-z0-9-]{1,64}\\.(?:png|jpg|webp)$`,
	);

	function file(slug: string, source: RiotImageSource): AssetFile | undefined {
		const url = parseUrl(source.url);
		const format = formatByMime.get(source.mime);
		if (
			!url ||
			!format ||
			!/^[0-9a-f]{64}$/i.test(source.sha256) ||
			!Number.isSafeInteger(source.size) ||
			source.size < 1 ||
			source.size > maxRiotImageBytes
		)
			return undefined;
		const expected = source.sha256.toLowerCase();
		return {
			path: `${folder}/${slug}.${format}`,
			url,
			limit: maxRiotImageBytes,
			check: (bytes) =>
				bytes.length === source.size &&
				sniffImage(bytes) === format &&
				createHash("sha256").update(bytes).digest("hex") === expected,
		};
	}

	async function readManifest(root: string): Promise<Map<string, Entry>> {
		const manifest = await readJson(
			await cachePath(root, "manifest.json"),
			manifestLimit,
		);
		const entries = new Map<string, Entry>();
		const images = isRecord(manifest) && manifest[folder];
		if (isRecord(images)) {
			for (const [id, entry] of Object.entries(images)) {
				if (
					isRecord(entry) &&
					isDigest(entry) &&
					typeof entry.path === "string" &&
					imagePath.test(entry.path)
				)
					entries.set(id, {
						path: entry.path,
						size: entry.size,
						sha256: entry.sha256,
					});
			}
		}
		return entries;
	}

	async function readVerifiedImage(root: string, entry: Entry) {
		if (entry.size > maxRiotImageBytes) return undefined;
		const bytes = await readBytes(
			await cachePath(root, entry.path),
			entry.size,
		);
		if (!bytes || bytes.length !== entry.size) return undefined;
		const format = sniffImage(bytes);
		if (
			format &&
			entry.path.endsWith(`.${format}`) &&
			createHash("sha256").update(bytes).digest("hex") === entry.sha256
		)
			return bytes;
	}

	/** Return the same bytes that were verified, so serving requires only one read. */
	async function readImage(root: string, path: string) {
		if (!imagePath.test(path)) return undefined;
		for (const entry of (await readManifest(root)).values())
			if (entry.path === path) return readVerifiedImage(root, entry);
	}

	async function readPaths(root: string): Promise<Record<string, string>> {
		const paths = new Map<string, string>();
		for (const [id, entry] of await readManifest(root))
			if (await readVerifiedImage(root, entry).catch(() => undefined))
				paths.set(id, entry.path);
		return Object.fromEntries(paths);
	}

	async function sync(
		root: string,
		sources: readonly RiotImageSource[],
		transport: AssetTransport,
	): Promise<{ failed: string[] }> {
		const slugs = imageSlugs(
			sources.map(({ id }) => id),
			folder === "teams" ? "team" : "player",
		);
		const entries = await readManifest(root);
		const failed: string[] = [];
		if (folder === "players") {
			// An offline sync must not expose photos dropped or changed by the snapshot.
			const byId = new Map(sources.map((source) => [source.id, source]));
			for (const [id, entry] of entries) {
				const source = byId.get(id);
				const slug = slugs.get(id);
				if (
					!source ||
					!slug ||
					entry.path !== file(slug, source)?.path ||
					entry.sha256 !== source.sha256 ||
					entry.size !== source.size
				)
					entries.delete(id);
			}
		}
		try {
			for (const source of sources) {
				const slug = slugs.get(source.id);
				const asset = slug && file(slug, source);
				if (!asset) {
					failed.push(source.id);
					continue;
				}
				const known = entries.get(source.id);
				if (
					known?.path === asset.path &&
					known.sha256 === source.sha256.toLowerCase() &&
					known.size === source.size &&
					(await readVerifiedImage(root, known).catch(() => undefined))
				)
					continue;
				entries.delete(source.id);
				try {
					const destination = await cachePath(root, asset.path, true);
					for (const stale of [
						destination,
						`${destination}.part`,
						`${destination}.part.json`,
					])
						await rm(stale, { force: true });
					const digest = await downloadFile(root, asset, transport);
					entries.set(source.id, { ...digest, path: asset.path });
				} catch (error) {
					if (error instanceof NetworkUnavailable) break;
					failed.push(source.id);
				}
			}
		} finally {
			await writeJson(await cachePath(root, "manifest.json", true), {
				[folder]: Object.fromEntries(entries),
			});
		}
		return { failed };
	}

	return { file, readImage, readPaths, sync };
}
