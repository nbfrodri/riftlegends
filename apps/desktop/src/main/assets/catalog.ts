import {
	championAssetClassesSchema,
	championAssetIdSchema,
	championCatalogSchema,
	type LocalizedChampionAsset,
	localizedChampionAssetSchema,
	localizedChampionCatalogSchema,
	maxAssetChampions,
} from "@rift-legends/contracts";

export const dataDragon = "https://ddragon.leagueoflegends.com";
export const communityDragon = "https://raw.communitydragon.org";
export const versionsUrl = new URL("/api/versions.json", dataDragon);
export const maxCatalogBytes = 4 * 1024 * 1024;
export const maxImageBytes = 1024 * 1024;
const championLocales = { en: "en_gb", es: "es_es" } as const;
export type ChampionLocale = keyof typeof championLocales;
const gameData = "plugins/rcp-be-lol-game-data/global";

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
	return (
		typeof value === "string" &&
		/^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/.test(value)
	);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function catalogPath(locale: ChampionLocale) {
	return `catalog/${locale}.json`;
}

export function championSummaryFile(
	version: string,
	locale: ChampionLocale,
): AssetFile {
	return {
		path: `upstream/${locale}.json`,
		url: new URL(
			`/${version}/${gameData}/${championLocales[locale]}/v1/champion-summary.json`,
			communityDragon,
		),
		limit: maxCatalogBytes,
	};
}

export function portraitFile(
	version: string,
	champion: LocalizedChampionAsset,
): AssetFile {
	return {
		path: `champions/${champion.id}.png`,
		url: new URL(
			`/${version}/${gameData}/default/v1/champion-icons/${champion.key}.png`,
			communityDragon,
		),
		limit: maxImageBytes,
	};
}

export function parseChampionSummary(
	catalog: unknown,
): LocalizedChampionAsset[] {
	if (
		!Array.isArray(catalog) ||
		!catalog.length ||
		catalog.length > maxAssetChampions
	)
		throw new Error("Invalid champion count");

	const champions: LocalizedChampionAsset[] = [];
	for (const entry of catalog) {
		if (!isRecord(entry)) throw new Error("Invalid champion summary entry");
		if (entry.id === -1 && entry.alias === "None") continue;
		// CommunityDragon also lists Jade variants with a separate ID range.
		if (
			typeof entry.id === "number" &&
			Number.isInteger(entry.id) &&
			entry.id >= 60000 &&
			entry.id < 61000 &&
			typeof entry.alias === "string" &&
			/^Jade_[A-Za-z0-9]{1,59}$/.test(entry.alias)
		)
			continue;
		const id = championAssetIdSchema.parse(entry.alias);
		const key = localizedChampionAssetSchema.shape.key.parse(entry.id);
		const classes = championAssetClassesSchema.safeParse(entry.roles);
		if (!classes.success) continue;
		if (
			entry.squarePortraitPath !==
			`/lol-game-data/assets/v1/champion-icons/${key}.png`
		)
			throw new Error("Invalid champion portrait path");
		champions.push(
			localizedChampionAssetSchema.parse({
				id,
				key,
				name: entry.name,
				title: entry.description,
				classes: classes.data,
			}),
		);
	}
	return localizedChampionCatalogSchema.parse(
		champions.sort((a, b) => a.key - b.key),
	);
}

export function mergeChampionCatalogs(
	english: LocalizedChampionAsset[],
	spanish: LocalizedChampionAsset[],
) {
	const byKey = new Map(spanish.map((entry) => [entry.key, entry]));
	if (english.length !== spanish.length)
		throw new Error("Champion catalogs disagree");
	return championCatalogSchema.parse(
		english.map((en) => {
			const es = byKey.get(en.key);
			if (
				!es ||
				es.id !== en.id ||
				es.classes.length !== en.classes.length ||
				en.classes.some((role) => !es.classes.includes(role))
			)
				throw new Error("Champion catalogs disagree");
			return {
				id: en.id,
				key: en.key,
				names: { en: en.name, es: es.name },
				titles: { en: en.title, es: es.title },
				classes: en.classes,
			};
		}),
	);
}
