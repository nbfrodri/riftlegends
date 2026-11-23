import { parseRiotLogoUrl } from "@rift-legends/contracts";
import { createRiotImageCache, imageSlugs } from "./riot-images";

export {
	type RiotImageSource as TeamLogoSource,
	sniffImage,
} from "./riot-images";

export const {
	file: logoFile,
	readImage: readLogo,
	readPaths: readTeamLogos,
	sync: syncTeamLogos,
} = createRiotImageCache("teams", parseRiotLogoUrl);

export const teamLogoSlugs = (ids: readonly string[]) =>
	imageSlugs(ids, "team");
