import { join } from "node:path";
import { maxCatalogBytes, maxImageBytes, maxLogoBytes } from "./catalog";
import { cachePath, readBytes } from "./disk";
import { type LogoFormat, logoMimes, readLogoEntry } from "./logos";
import { readActiveVersion } from "./store";

export const assetScheme = "rift-asset";

const logoRequest =
	/^rift-asset:\/\/leaguepedia\/(teams\/[a-z0-9-]{1,64}\.(png|jpg|webp))$/;

async function serveLogo(userData: string, path: string, format: LogoFormat) {
	const root = join(userData, "assets", "leaguepedia");
	// Only files named by the manifest, and only while they still match it.
	if (!(await readLogoEntry(root, path))) return undefined;
	const bytes = await readBytes(await cachePath(root, path), maxLogoBytes);
	return (
		bytes &&
		new Response(bytes, {
			headers: {
				"cache-control": "no-store",
				"content-type": logoMimes[format],
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
	const logo = logoRequest.exec(request.url);
	if (logo?.[1] && logo[2]) {
		try {
			return (
				(await serveLogo(userData, logo[1], logo[2] as LogoFormat)) ??
				notFound()
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
		const png = path.endsWith(".png");
		if (!png && !path.endsWith(".json")) return notFound();

		const sourcePath = "assets/cdragon";
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
