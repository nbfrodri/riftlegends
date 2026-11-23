import { z } from "zod";

/**
 * Team logo sources of the real snapshot (`content/real/logos.json`), made by
 * the dev/CI data pipeline from the public lolesports.com API. The app treats
 * the file as untrusted input: only these exact Riot hosts and path shapes,
 * https, no credentials, port, query or fragment.
 */
export const riotImageFile = String.raw`[A-Za-z0-9_.%()-]{1,200}\.(?:png|jpe?g|webp)`;
const logoHosts = new Map([
	["static.lolesports.com", new RegExp(`^/teams/${riotImageFile}$`, "i")],
	[
		"lolstatic-a.akamaihd.net",
		new RegExp(`^/esports-assets/production/team/${riotImageFile}$`, "i"),
	],
]);

export function parseRiotLogoUrl(value: string): URL | undefined {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	const shape = logoHosts.get(url.hostname);
	return url.protocol === "https:" &&
		shape?.test(url.pathname) &&
		!url.username &&
		!url.password &&
		!url.port &&
		!url.search &&
		!url.hash &&
		!/%2e|%2f|%5c/i.test(url.pathname)
		? url
		: undefined;
}

export const riotLogoHosts: readonly string[] = [...logoHosts.keys()];

/** The image type of PNG, JPEG and WebP bytes (never SVG), or undefined. */
export function sniffImageMime(bytes: Uint8Array): string | undefined {
	const at = (offset: number, text: string) =>
		[...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
	if (
		bytes.length >= 8 &&
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
			(byte, i) => bytes[i] === byte,
		)
	)
		return "image/png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
		return "image/jpeg";
	if (bytes.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
	return undefined;
}

export const maxRiotImageBytes = 512 * 1024;

export const riotImageMetadata = {
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
	size: z.number().int().min(1).max(maxRiotImageBytes),
	mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
};

export const lolesportsProvenance = z.strictObject({
	source: z.literal("lolesports.com"),
	endpoint: z.httpUrl(),
	retrievedAt: z.iso.datetime(),
	note: z.string(),
});

const realLogoSchema = z.strictObject({
	team: z.string().min(1),
	url: z.string().refine((value) => parseRiotLogoUrl(value) !== undefined),
	...riotImageMetadata,
});
export type RealLogo = z.infer<typeof realLogoSchema>;

export const realLogosSchema = z.strictObject({
	provenance: lolesportsProvenance,
	logos: z
		.array(realLogoSchema)
		.refine(
			(logos) => new Set(logos.map(({ team }) => team)).size === logos.length,
		),
});
export type RealLogos = z.infer<typeof realLogosSchema>;
