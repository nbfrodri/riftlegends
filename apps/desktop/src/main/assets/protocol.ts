import { maxCatalogBytes, maxImageBytes } from "./catalog";
import { cachePath, readBytes } from "./disk";
import { readActiveVersion } from "./store";

export const assetScheme = "rift-asset";

export async function serveAsset(
	userData: string,
	request: Pick<Request, "url" | "method">,
): Promise<Response> {
	const notFound = () => new Response(null, { status: 404 });
	if (request.method !== "GET") return notFound();
	// Chromium and Electron can remove dot segments before dispatch.
	// Containment must also hold for the canonical URL we receive.
	const match = /^rift-asset:\/\/(ddragon|cdragon)\/([^?#]+)$/.exec(
		request.url,
	);
	const [, source, encoded] = match ?? [];
	if (!source || !encoded) return notFound();

	try {
		// Escaped separators must never become path separators. cachePath
		// rejects dot segments and checks every parent for symlinks.
		const segments = encoded.split("/").map(decodeURIComponent);
		if (segments.some((segment) => segment.includes("/"))) return notFound();
		const path = segments.join("/");
		const png = path.endsWith(".png");
		if (!png && !path.endsWith(".json")) return notFound();

		const sourcePath = `assets/${source}`;
		const pointer = await cachePath(userData, `${sourcePath}/current.json`);
		const version = await readActiveVersion(pointer);
		if (!version) return notFound();
		const file = await cachePath(userData, `${sourcePath}/${version}/${path}`);
		const bytes = await readBytes(file, png ? maxImageBytes : maxCatalogBytes);
		if (!bytes) return notFound();

		return new Response(bytes, {
			headers: {
				"cache-control": "no-store",
				"content-type": png ? "image/png" : "application/json",
				"x-content-type-options": "nosniff",
			},
		});
	} catch {
		return notFound();
	}
}
