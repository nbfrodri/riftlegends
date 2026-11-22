export const dataDragon = "https://ddragon.leagueoflegends.com";
export const communityDragon = "https://raw.communitydragon.org";
export const versionsUrl = new URL("/api/versions.json", dataDragon);
export const maxCatalogBytes = 4 * 1024 * 1024;
export const maxImageBytes = 1024 * 1024;
const maxChampions = 512;

export const championCatalogs = [
	"data/es_ES/champion.json",
	"data/en_US/champion.json",
] as const;

const positions = "plugins/rcp-fe-lol-parties/global/default";
const scoreboard = "game/assets/ux/scoreboard";
const minimap = "game/assets/ux/minimap/icons";

// CommunityDragon's stable latest alias. Keep upstream filenames here so a
// moved icon can be fixed without changing the local paths used by the game.
const communityIcons = {
	"roles/top.png": `${positions}/icon-position-button-top.png`,
	"roles/jungle.png": `${positions}/icon-position-button-jungle.png`,
	"roles/mid.png": `${positions}/icon-position-button-middle.png`,
	"roles/bot.png": `${positions}/icon-position-button-bottom.png`,
	"roles/support.png": `${positions}/icon-position-button-utility.png`,
	"objectives/dragon.png": `${scoreboard}/_dragon.png`,
	"objectives/baron.png": `${scoreboard}/_baronnashor.png`,
	"objectives/herald.png": `${scoreboard}/_riftherald.png`,
	"objectives/elder.png": `${scoreboard}/_elderdrake.png`,
	"objectives/tower.png": `${minimap}/icon_ui_tower_minimap.png`,
	"objectives/inhibitor.png": `${minimap}/inhibitor.png`,
	"objectives/nexus.png": `${minimap}/nexus.png`,
};

export const communityFiles = Object.entries(communityIcons).map(
	([path, upstream]) => ({
		path,
		url: new URL(`/latest/${upstream}`, communityDragon),
		limit: maxImageBytes,
	}),
);

export type AssetFile = (typeof communityFiles)[number];

export function isVersion(value: unknown): value is string {
	return typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChampionId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^[A-Za-z0-9]{1,64}$/.test(value) &&
		!/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(value)
	);
}

export function portraitPaths(catalog: unknown): string[] {
	if (!isRecord(catalog) || !isRecord(catalog.data))
		throw new Error("Invalid champion catalog");
	const entries = Object.entries(catalog.data);
	if (entries.length === 0 || entries.length > maxChampions)
		throw new Error("Invalid champion count");

	const ids = new Set<string>();
	return entries
		.map(([key, champion]) => {
			if (
				!isRecord(champion) ||
				!isChampionId(champion.id) ||
				champion.id !== key
			) {
				throw new Error("Invalid champion ID");
			}
			const canonical = key.toLowerCase();
			if (ids.has(canonical)) throw new Error("Duplicate champion ID");
			ids.add(canonical);
			return `img/champion/${key}.png`;
		})
		.sort();
}

export function dataDragonFiles(
	version: string,
	paths: readonly string[],
): AssetFile[] {
	return paths.map((path) => ({
		path,
		url: new URL(`/cdn/${version}/${path}`, dataDragon),
		limit: path.endsWith(".json") ? maxCatalogBytes : maxImageBytes,
	}));
}
