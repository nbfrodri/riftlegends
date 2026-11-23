import { parseRiotPhotoUrl } from "@rift-legends/contracts/real-photos";
import { createRiotImageCache } from "./riot-images";

export const {
	readImage: readPhoto,
	readPaths: readPlayerPhotos,
	sync: syncPlayerPhotos,
} = createRiotImageCache("players", parseRiotPhotoUrl);
