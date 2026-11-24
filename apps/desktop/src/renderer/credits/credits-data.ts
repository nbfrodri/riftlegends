import notice from "../../../../../NOTICE.md?raw";

/** Riot Games' fan-project notice, taken from NOTICE.md (its single source). */
export const riotNotice =
	notice
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.find((paragraph) => paragraph.startsWith("Rift Legends isn't endorsed")) ??
	"";

export interface Source {
	id: "leaguepedia" | "communityDragon" | "lolesports";
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
	},
	{ id: "lolesports", name: "lolesports.com", url: "https://lolesports.com/" },
];

export interface Library {
	name: string;
	licence: string;
	url: string;
}

const library = (name: string, licence: string): Library => ({
	name,
	licence,
	url: `https://www.npmjs.com/package/${name}`,
});

// Runtime dependencies of the workspaces plus Electron, which the installer
// bundles. A test compares this list with the package.json files, so adding
// a dependency without crediting it fails the build.
export const LIBRARIES: readonly Library[] = [
	library("@base-ui/react", "MIT"),
	library("@fontsource-variable/archivo", "OFL-1.1"),
	library("@fontsource-variable/unbounded", "OFL-1.1"),
	library("@tanstack/react-query", "MIT"),
	library("@tanstack/react-router", "MIT"),
	library("@tanstack/react-table", "MIT"),
	library("@tanstack/react-virtual", "MIT"),
	library("clsx", "MIT"),
	library("country-flag-icons", "MIT"),
	library("electron", "MIT"),
	library("i18next", "MIT"),
	library("lucide-react", "ISC"),
	library("motion", "MIT"),
	library("pixi.js", "MIT"),
	library("pure-rand", "MIT"),
	library("react", "MIT"),
	library("react-dom", "MIT"),
	library("react-i18next", "MIT"),
	library("tailwind-merge", "MIT"),
	library("tailwindcss", "MIT"),
	library("zod", "MIT"),
];
