import { createHash } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { type AssetFile, isRecord } from "./catalog";
import {
	cachePath,
	type Digest,
	isDigest,
	matches,
	readBytes,
	readJson,
	writeJson,
} from "./disk";
import {
	AssetHttpError,
	type AssetTransport,
	NetworkUnavailable,
	responseLength,
	withResponse,
} from "./transport";

const checkpointBytes = 128 * 1024;
const metadataLimit = 4096;
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

interface Checkpoint extends Digest {
	etag?: string;
	complete: boolean;
}

function isStrongEtag(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= 256 &&
		/^"[\x21\x23-\x7e]*"$/.test(value)
	);
}

function isCheckpoint(value: unknown): value is Checkpoint {
	return (
		isRecord(value) &&
		typeof value.complete === "boolean" &&
		(value.etag === undefined || isStrongEtag(value.etag)) &&
		isDigest(value)
	);
}

function rangeTotal(
	value: unknown,
	start: number,
	limit: number,
): number | undefined {
	if (typeof value !== "string") return undefined;
	const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value);
	if (!match) return undefined;
	const first = Number(match[1]);
	const last = Number(match[2]);
	const total = Number(match[3]);
	return first === start &&
		total <= limit &&
		total > start &&
		last === total - 1
		? total
		: undefined;
}

async function receive({
	part,
	metadata,
	prefix,
	etag,
	expected,
	limit,
	body,
}: {
	part: string;
	metadata: string;
	prefix: Buffer;
	etag: string | undefined;
	expected: number | undefined;
	limit: number;
	body: AsyncIterable<Uint8Array>;
}): Promise<Digest | undefined> {
	const hash = createHash("sha256").update(prefix);
	let size = prefix.length;
	let saved = size;
	const file = await open(part, size ? "r+" : "w");
	const savePartial = async () => {
		await file.sync();
		await writeJson(metadata, {
			size,
			sha256: hash.copy().digest("hex"),
			etag,
			complete: false,
		});
		saved = size;
	};
	try {
		if (size) await file.truncate(size);
		for await (const chunk of body) {
			if (size + chunk.length > (expected ?? limit)) return undefined;
			let written = 0;
			while (written < chunk.length) {
				const { bytesWritten } = await file.write(
					chunk,
					written,
					chunk.length - written,
					size + written,
				);
				if (!bytesWritten) throw new Error("Unable to write asset");
				written += bytesWritten;
			}
			hash.update(chunk);
			size += chunk.length;
			if (etag && size - saved >= checkpointBytes) await savePartial();
		}
		if (!size || (expected !== undefined && size !== expected))
			return undefined;
		await file.sync();
		return { size, sha256: hash.digest("hex") };
	} catch (error) {
		if (error instanceof NetworkUnavailable && etag && size > saved)
			await savePartial();
		throw error;
	} finally {
		await file.close();
	}
}

export async function downloadFile(
	root: string,
	file: AssetFile,
	transport: AssetTransport,
): Promise<Digest> {
	const destination = await cachePath(root, file.path, true);
	const part = `${destination}.part`;
	const metadata = `${part}.json`;
	const saved = await readJson(metadata, metadataLimit);
	let prefix: Buffer = Buffer.alloc(0);
	let resumeTag: string | undefined;

	if (isCheckpoint(saved)) {
		const digest = { size: saved.size, sha256: saved.sha256 };
		if (saved.complete && (await matches(destination, digest, file.limit)))
			return digest;
		if (saved.complete && (await matches(part, digest, file.limit))) {
			await rename(part, destination);
			return digest;
		}
		if (!saved.complete && saved.etag) {
			const bytes = await readBytes(part, file.limit, saved.size);
			if (
				bytes &&
				createHash("sha256").update(bytes).digest("hex") === saved.sha256
			) {
				prefix = bytes;
				resumeTag = saved.etag;
			}
		}
	}
	await rm(destination, { force: true });

	for (let attempt = 0; attempt < 3; attempt++) {
		if (!prefix.length) {
			await rm(metadata, { force: true });
			await rm(part, { force: true });
		}
		const headers: Record<string, string> = {};
		if (prefix.length && resumeTag) {
			headers.Range = `bytes=${prefix.length}-`;
			headers["If-Range"] = resumeTag;
		}
		const result = await withResponse(
			transport,
			file.url,
			headers,
			async (response) => {
				if (response.status === 416) return undefined;
				const length = responseLength(response.headers["content-length"]);
				const tag = response.headers.etag;
				const etag = isStrongEtag(tag) ? tag : undefined;
				let expected = length;
				if (response.status === 206) {
					expected = rangeTotal(
						response.headers["content-range"],
						prefix.length,
						file.limit,
					);
					if (
						!headers.Range ||
						etag !== resumeTag ||
						!expected ||
						(length !== undefined && length !== expected - prefix.length)
					)
						return undefined;
				} else if (response.status === 200) {
					prefix = Buffer.alloc(0);
					await rm(metadata, { force: true });
				} else {
					throw new AssetHttpError(response.status);
				}
				if (
					expected !== undefined &&
					(expected <= 0 || expected > file.limit)
				) {
					throw new Error("Asset exceeds size limit");
				}
				return receive({
					part,
					metadata,
					prefix,
					etag,
					expected,
					limit: file.limit,
					body: response.body,
				});
			},
		);

		if (result && (await matches(part, result, file.limit))) {
			const bytes = await readBytes(part, file.limit);
			const validFormat =
				!!bytes &&
				(!file.path.endsWith(".png") ||
					bytes.subarray(0, pngSignature.length).equals(pngSignature)) &&
				(file.check?.(bytes) ?? true);
			if (validFormat) {
				await writeJson(metadata, { ...result, complete: true });
				await rename(part, destination);
				return result;
			}
		}
		prefix = Buffer.alloc(0);
		resumeTag = undefined;
	}
	await rm(metadata, { force: true });
	await rm(part, { force: true });
	throw new Error("Unable to verify downloaded asset");
}
