import { createHash } from "node:crypto";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isRecord } from "./catalog";

export interface Digest {
	size: number;
	sha256: string;
}

export function isDigest(value: unknown): value is Digest {
	return (
		isRecord(value) &&
		typeof value.size === "number" &&
		Number.isSafeInteger(value.size) &&
		value.size > 0 &&
		typeof value.sha256 === "string" &&
		/^[a-f0-9]{64}$/.test(value.sha256)
	);
}

export async function statIfPresent(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		)
			return undefined;
		throw error;
	}
}

// userData is the trusted anchor provided by Electron. Every descendant is
// checked one component at a time before it is used, including on Windows.
export async function cachePath(
	root: string,
	path: string,
	createParents = false,
): Promise<string> {
	const parts = path.split("/");
	if (
		parts.some((part) => !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(part))
	) {
		throw new Error("Invalid cache path");
	}
	const target = resolve(root, ...parts);
	const local = relative(root, target);
	if (
		!local ||
		local === ".." ||
		local.startsWith(`..${sep}`) ||
		isAbsolute(local)
	) {
		throw new Error("Path outside asset cache");
	}
	let directory = root;
	for (const part of parts.slice(0, -1)) {
		directory = resolve(directory, part);
		if (createParents) await mkdir(directory, { recursive: true });
		const stat = await statIfPresent(directory);
		if (stat && !stat.isDirectory()) throw new Error("Invalid asset directory");
	}
	return target;
}

async function fileSize(path: string): Promise<number | undefined> {
	const stat = await statIfPresent(path);
	if (stat && (!stat.isFile() || stat.nlink !== 1))
		throw new Error("Invalid asset file");
	return stat?.size;
}

export async function readBytes(
	path: string,
	limit: number,
	prefix?: number,
): Promise<Buffer<ArrayBuffer> | undefined> {
	const size = await fileSize(path);
	if (
		size === undefined ||
		size > limit ||
		(prefix !== undefined && prefix > size)
	)
		return undefined;
	const data = Buffer.alloc(prefix ?? size);
	const file = await open(path, "r");
	try {
		let offset = 0;
		while (offset < data.length) {
			const { bytesRead } = await file.read(
				data,
				offset,
				data.length - offset,
				offset,
			);
			if (!bytesRead) return undefined;
			offset += bytesRead;
		}
		return data;
	} finally {
		await file.close();
	}
}

export async function readJson(path: string, limit: number): Promise<unknown> {
	const bytes = await readBytes(path, limit);
	if (!bytes) return undefined;
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		return undefined;
	}
}

export async function matches(
	path: string,
	digest: Digest,
	limit: number,
): Promise<boolean> {
	if (digest.size > limit) return false;
	const bytes = await readBytes(path, digest.size);
	return (
		bytes?.length === digest.size &&
		createHash("sha256").update(bytes).digest("hex") === digest.sha256
	);
}

export async function writeJson(path: string, value: unknown): Promise<void> {
	const temporary = `${path}.tmp`;
	await rm(temporary, { force: true });
	const handle = await open(temporary, "wx");
	try {
		await handle.writeFile(JSON.stringify(value));
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(temporary, path);
}

export async function syncDirectory(path: string): Promise<void> {
	if (process.platform === "win32") return;
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
