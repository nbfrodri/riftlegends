import { z } from "zod";
import {
	lolesportsProvenance,
	riotImageFile,
	riotImageMetadata,
} from "./real-logos.ts";

const photoUrl = new RegExp(
	String.raw`^https://(?:static\.lolesports\.com/players|lolstatic-a\.akamaihd\.net/esports-assets/production/player)/${riotImageFile}$`,
	"i",
);

/** Check the raw URL before URL normalization can remove forbidden components. */
export function parseRiotPhotoUrl(value: string): URL | undefined {
	if (
		!photoUrl.test(value) ||
		/%2e|%2f|%5c/i.test(value) ||
		value.trim() !== value
	)
		return undefined;
	return new URL(value);
}

export const realPhotoSchema = z.strictObject({
	player: z.string().min(1),
	url: z.string().refine((value) => parseRiotPhotoUrl(value) !== undefined),
	...riotImageMetadata,
});

export const realPhotosSchema = z.strictObject({
	provenance: lolesportsProvenance,
	photos: z
		.array(realPhotoSchema)
		.refine(
			(photos) =>
				new Set(photos.map(({ player }) => player)).size === photos.length,
		),
});

export type RealPhotos = z.infer<typeof realPhotosSchema>;
