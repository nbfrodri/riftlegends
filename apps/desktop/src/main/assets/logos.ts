import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import {
	type AssetFile,
	isRecord,
	leaguepediaImages,
	maxLogoBytes,
} from "./catalog";
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
 * Leaguepedia image host listed in the real snapshot, which is untrusted input:
 * strict URL shape, no redirects (the transport never follows them), SHA-1 of
 * the snapshot, magic bytes (PNG, JPEG, WebP; never SVG), a size limit, and a
 * local name made from a slug of the team id, never from the remote file name.
 */
export interface TeamLogoSource {
	id: string;
	url: string;
	sha1: string;
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
const imagePath =
	/^\/lolesports_gamepedia_en\/images\/[0-9a-f]\/[0-9a-f]{2}\/[A-Za-z0-9_.%()'!,~+-]{1,200}\/revision\/latest$/;
const manifestLimit = 256 * 1024;
const reserved = /^(?:con|prn|aux|nul|com\d|lpt\d)$/;

export function parseLogoUrl(value: string): URL | undefined {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	const filename = url.pathname.split("/")[5];
	return url.origin === leaguepediaImages &&
		url.protocol === "https:" &&
		!url.username &&
		!url.password &&
		!url.port &&
		!url.hash &&
		(url.search === "" || /^\?cb=\d{1,20}$/.test(url.search)) &&
		imagePath.test(url.pathname) &&
		filename !== "." &&
		filename !== ".." &&
		!/%2e|%2f|%5c/i.test(url.pathname)
		? url
		: undefined;
}

export function sniffImage(bytes: Buffer): LogoFormat | undefined {
	if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
		return "png";
	if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
	if (
		bytes.length >= 12 &&
		bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
		bytes.subarray(8, 12).toString("latin1") === "WEBP"
	)
		return "webp";
	return undefined;
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
	const url = parseLogoUrl(source.url);
	const format = formatByMime.get(source.mime);
	if (!url || !format || !/^[0-9a-f]{40}$/i.test(source.sha1)) return undefined;
	const expected = source.sha1.toLowerCase();
	return {
		path: `teams/${slug}.${format}`,
		url,
		limit: maxLogoBytes,
		check: (bytes) =>
			sniffImage(bytes) === format &&
			createHash("sha1").update(bytes).digest("hex") === expected,
	};
}

interface Entry extends Digest {
	path: string;
	sha1: string;
}

function isEntry(value: unknown): value is Entry {
	return (
		isRecord(value) &&
		isDigest(value) &&
		typeof value.path === "string" &&
		logoPath.test(value.path) &&
		typeof value.sha1 === "string" &&
		/^[0-9a-f]{40}$/.test(value.sha1)
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
			const sha1 = source.sha1.toLowerCase();
			if (
				known?.path === file.path &&
				known.sha1 === sha1 &&
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
				entries.set(source.id, { ...digest, path: file.path, sha1 });
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
