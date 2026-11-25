import notice from "../../../../../NOTICE.md?raw";

/** Riot Games' fan-project notice, taken from NOTICE.md (its single source). */
export const riotNotice =
	notice
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.find((paragraph) => paragraph.startsWith("Rift Legends isn't endorsed")) ??
	"";

export interface Source {
	id: "leaguepedia" | "communityDragon" | "lolesports" | "kenney";
	/** Shown in the source's card when it has no licence link. */
	badge?: "cache" | "api";
	name: string;
	url: string;
	licence?: string;
	licenceUrl?: string;
}

export const SOURCES: readonly Source[] = [
	{
		id: "leaguepedia",
		name: "Leaguepedia",
		url: "https://lol.fandom.com/wiki/Leaguepedia",
		licence: "CC BY-SA 3.0",
		licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
	},
	{
		id: "communityDragon",
		name: "CommunityDragon",
		url: "https://www.communitydragon.org/",
		badge: "cache",
	},
	{
		id: "lolesports",
		name: "lolesports.com",
		url: "https://lolesports.com/",
		badge: "api",
	},
	{
		id: "kenney",
		name: "Kenney",
		url: "https://kenney.nl/assets/cursor-pack",
		licence: "CC0 1.0",
		licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
	},
];

/** Areas the libraries are shown under, in this order. */
export const LIBRARY_GROUPS = ["interface", "data", "engine", "fonts"] as const;
type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

export interface Library {
	name: string;
	licence: string;
	url: string;
	group: LibraryGroup;
}

const library = (
	name: string,
	licence: string,
	group: LibraryGroup,
): Library => ({
	name,
	licence,
	group,
	url: `https://www.npmjs.com/package/${name}`,
});

// Runtime dependencies of the workspaces plus Electron, which the installer
// bundles. A test compares this list with the package.json files, so adding
// a dependency without crediting it fails the build.
export const LIBRARIES: readonly Library[] = [
	library("@base-ui/react", "MIT", "interface"),
	library("@fontsource-variable/archivo", "OFL-1.1", "fonts"),
	library("@fontsource-variable/unbounded", "OFL-1.1", "fonts"),
	library("@tanstack/react-query", "MIT", "data"),
	library("@tanstack/react-router", "MIT", "data"),
	library("@tanstack/react-table", "MIT", "data"),
	library("@tanstack/react-virtual", "MIT", "data"),
	library("clsx", "MIT", "interface"),
	library("country-flag-icons", "MIT", "interface"),
	library("electron", "MIT", "engine"),
	library("i18next", "MIT", "data"),
	library("lucide-react", "ISC", "interface"),
	library("motion", "MIT", "interface"),
	library("pixi.js", "MIT", "interface"),
	library("pure-rand", "MIT", "engine"),
	library("react", "MIT", "interface"),
	library("react-dom", "MIT", "interface"),
	library("react-i18next", "MIT", "data"),
	library("tailwind-merge", "MIT", "interface"),
	library("tailwindcss", "MIT", "interface"),
	library("zod", "MIT", "engine"),
];
