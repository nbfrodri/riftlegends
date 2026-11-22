import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { parseRiotLogoUrl, sniffImageMime } from "@rift-legends/contracts";
import { type AssetFile, isRecord, maxLogoBytes } from "./catalog";
import {
	cachePath,
	type Digest,
	isDigest,
	matches,
	readJson,
	writeJson,
} from "./disk";
import { downloadFile } from "./download";
import { type AssetTransport, NetworkUnavailable } from "./transport";

/**
 * Team logos (trademarks of their owners) are downloaded at runtime from the
 * Riot image hosts listed in `content/real/logos.json`, which is untrusted
 * input: exact hosts and path shape (`parseRiotLogoUrl`), no redirects (the
 * transport never follows them), SHA-256 and size of the file, magic bytes
 * (PNG, JPEG, WebP; never SVG), a size limit, and a local name made from a
 * slug of the team id, never from the remote file name.
 */
export interface TeamLogoSource {
	id: string;
	url: string;
	sha256: string;
	size: number;
	mime: string;
}

export type LogoFormat = "png" | "jpg" | "webp";
export const logoMimes: Record<LogoFormat, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp",
};
const formatByMime = new Map<string, LogoFormat>(
	(Object.entries(logoMimes) as [LogoFormat, string][]).map(([f, m]) => [m, f]),
);

const logoPath = /^teams\/[a-z0-9-]{1,64}\.(?:png|jpg|webp)$/;
const manifestLimit = 256 * 1024;
const reserved = /^(?:con|prn|aux|nul|com\d|lpt\d)$/;

export function sniffImage(bytes: Buffer): LogoFormat | undefined {
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

/**
 * Maps team ids to unique `[a-z0-9-]{1,64}` slugs. Ids that collide (or whose
 * slug is a reserved Windows device name, or empty) get a hash of the id, so a
 * slug does not depend on the other teams' order.
 */
export function teamLogoSlugs(ids: readonly string[]): Map<string, string> {
	const bases = new Map(ids.map((id) => [id, baseSlug(id)]));
	const counts = new Map<string, number>();
	for (const base of bases.values())
		counts.set(base, (counts.get(base) ?? 0) + 1);
	const slugs = new Map<string, string>();
	for (const [id, base] of bases) {
		const plain = base && (counts.get(base) ?? 0) === 1 && !reserved.test(base);
		slugs.set(id, plain ? base : `${base || "team"}-${digestOf(id)}`);
	}
	if (new Set(slugs.values()).size !== slugs.size)
		throw new Error("Team logo slugs collide");
	return slugs;
}

export function logoFile(
	slug: string,
	source: TeamLogoSource,
): AssetFile | undefined {
	const url = parseRiotLogoUrl(source.url);
	const format = formatByMime.get(source.mime);
	if (
		!url ||
		!format ||
		!/^[0-9a-f]{64}$/i.test(source.sha256) ||
		!Number.isSafeInteger(source.size) ||
		source.size < 1 ||
		source.size > maxLogoBytes
	)
		return undefined;
	const expected = source.sha256.toLowerCase();
	return {
		path: `teams/${slug}.${format}`,
		url,
		limit: maxLogoBytes,
		check: (bytes) =>
			bytes.length === source.size &&
			sniffImage(bytes) === format &&
			createHash("sha256").update(bytes).digest("hex") === expected,
	};
}

interface Entry extends Digest {
	path: string;
}

function isEntry(value: unknown): value is Entry {
	return (
		isRecord(value) &&
		isDigest(value) &&
		typeof value.path === "string" &&
		logoPath.test(value.path)
	);
}

async function readManifest(root: string): Promise<Map<string, Entry>> {
	const manifest = await readJson(
		await cachePath(root, "manifest.json", true),
		manifestLimit,
	);
	const entries = new Map<string, Entry>();
	if (isRecord(manifest) && isRecord(manifest.teams)) {
		for (const [id, entry] of Object.entries(manifest.teams))
			if (isEntry(entry)) entries.set(id, entry);
	}
	return entries;
}

async function verifyLogo(root: string, entry: Entry): Promise<boolean> {
	return matches(await cachePath(root, entry.path), entry, maxLogoBytes);
}

/** The manifest entry for a local path, only if its file still matches. */
export async function readLogoEntry(
	root: string,
	path: string,
): Promise<Entry | undefined> {
	for (const entry of (await readManifest(root)).values())
		if (entry.path === path)
			return (await verifyLogo(root, entry)) ? entry : undefined;
	return undefined;
}

/** Team id to local path of every logo whose file still matches the manifest. */
export async function readTeamLogos(
	root: string,
): Promise<Record<string, string>> {
	const logos = new Map<string, string>();
	for (const [id, entry] of await readManifest(root))
		if (await verifyLogo(root, entry).catch(() => false))
			logos.set(id, entry.path);
	return Object.fromEntries(logos);
}

export async function syncTeamLogos(
	root: string,
	sources: readonly TeamLogoSource[],
	transport: AssetTransport,
): Promise<{ failed: string[] }> {
	const slugs = teamLogoSlugs(sources.map((source) => source.id));
	const entries = await readManifest(root);
	const failed: string[] = [];
	const save = async () =>
		writeJson(await cachePath(root, "manifest.json", true), {
			teams: Object.fromEntries(entries),
		});
	try {
		for (const source of sources) {
			const slug = slugs.get(source.id);
			const file = slug && logoFile(slug, source);
			if (!file) {
				failed.push(source.id);
				continue;
			}
			const known = entries.get(source.id);
			const sha256 = source.sha256.toLowerCase();
			if (
				known?.path === file.path &&
				known.sha256 === sha256 &&
				(await verifyLogo(root, known).catch(() => false))
			)
				continue;
			entries.delete(source.id);
			try {
				const destination = await cachePath(root, file.path, true);
				for (const stale of [
					destination,
					`${destination}.part`,
					`${destination}.part.json`,
				])
					await rm(stale, { force: true });
				const digest = await downloadFile(root, file, transport);
				entries.set(source.id, { ...digest, path: file.path });
			} catch (error) {
				if (error instanceof NetworkUnavailable) break;
				failed.push(source.id);
			}
		}
	} finally {
		await save();
	}
	return { failed };
}
