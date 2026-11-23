import { dirname } from "node:path";
import { maxCatalogBytes, maxImageBytes } from "./catalog";
import { cachePath, readBytes } from "./disk";
import { readLogo } from "./logos";
import { readPhoto } from "./photos";
import { type ImageFormat, imageMimes } from "./riot-images";
import { readActiveVersion } from "./store";

export const assetScheme = "rift-asset";

const cdragonTypes = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".json": "application/json",
} as const;

const imageRequest =
	/^rift-asset:\/\/(logos|photos)\/((?:teams|players)\/[a-z0-9-]{1,64}\.(png|jpg|webp))$/;

async function serveRiotImage(
	userData: string,
	source: string,
	path: string,
	format: ImageFormat,
) {
	const root = dirname(
		await cachePath(userData, `assets/${source}/manifest.json`),
	);
	// Only files named by the manifest, and only while they still match it.
	const readImage = source === "logos" ? readLogo : readPhoto;
	const bytes = await readImage(root, path);
	return (
		bytes &&
		new Response(bytes, {
			headers: {
				"cache-control": "no-store",
				"content-type": imageMimes[format],
				"x-content-type-options": "nosniff",
			},
		})
	);
}

export async function serveAsset(
	userData: string,
	request: Pick<Request, "url" | "method">,
): Promise<Response> {
	const notFound = () => new Response(null, { status: 404 });
	if (request.method !== "GET") return notFound();
	// Chromium and Electron can remove dot segments before dispatch.
	// Containment must also hold for the canonical URL we receive.
	const image = imageRequest.exec(request.url);
	if (image?.[1] && image[2] && image[3]) {
		try {
			return (
				(await serveRiotImage(
					userData,
					image[1],
					image[2],
					image[3] as ImageFormat,
				)) ?? notFound()
			);
		} catch {
			return notFound();
		}
	}
	const match = /^rift-asset:\/\/cdragon\/([^?#]+)$/.exec(request.url);
	const encoded = match?.[1];
	if (!encoded) return notFound();

	try {
		// Escaped separators must never become path separators. cachePath
		// rejects dot segments and checks every parent for symlinks.
		const segments = encoded.split("/").map(decodeURIComponent);
		if (segments.some((segment) => segment.includes("/"))) return notFound();
		const path = segments.join("/");
		const type = Object.entries(cdragonTypes).find(([extension]) =>
			path.endsWith(extension),
		)?.[1];
		if (!type) return notFound();
		const json = type === cdragonTypes[".json"];

		const sourcePath = "assets/cdragon";
		const pointer = await cachePath(userData, `${sourcePath}/current.json`);
		const version = await readActiveVersion(pointer);
		if (!version) return notFound();
		const file = await cachePath(userData, `${sourcePath}/${version}/${path}`);
		const bytes = await readBytes(file, json ? maxCatalogBytes : maxImageBytes);
		if (!bytes) return notFound();

		return new Response(bytes, {
			headers: {
				"cache-control": "no-store",
				"content-type": type,
				"x-content-type-options": "nosniff",
				// An SVG opened on its own must not run or load anything.
				...(type === cdragonTypes[".svg"] && {
					"content-security-policy": "default-src 'none'",
				}),
			},
		});
	} catch {
		return notFound();
	}
}
