import { createHash } from "node:crypto";
import { sniffImageMime } from "@rift-legends/contracts/real-logos";

export interface ImageDigest {
	sha256: string;
	size: number;
	mime: string;
}

export class Permanent extends Error {}

export const readImage =
	(limit: number) =>
	async (response: Response): Promise<ImageDigest> => {
		const declared = Number(response.headers.get("content-length") ?? 0);
		if (declared > limit) throw new Permanent("Image is too large");
		const chunks: Uint8Array[] = [];
		let size = 0;
		for await (const chunk of response.body ?? []) {
			size += chunk.length;
			if (size > limit) throw new Permanent("Image is too large");
			chunks.push(chunk);
		}
		const bytes = Buffer.concat(chunks);
		const mime = sniffImageMime(bytes);
		if (!mime) throw new Permanent("Not a PNG, JPEG or WebP image");
		return {
			sha256: createHash("sha256").update(bytes).digest("hex"),
			size,
			mime,
		};
	};

export function parseDigest(body: unknown): ImageDigest {
	const { sha256, size, mime } = (body ?? {}) as Partial<ImageDigest>;
	if (
		typeof sha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(sha256) ||
		!Number.isSafeInteger(size) ||
		typeof mime !== "string"
	)
		throw new Error("Invalid image digest");
	return { sha256, size: size as number, mime };
}
