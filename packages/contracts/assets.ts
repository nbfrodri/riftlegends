import { z } from "zod";

export const assetRequestArgs = z.tuple([]);

export const maxAssetChampions = 512;

export const championAssetIdSchema = z
	.string()
	.regex(/^[A-Za-z0-9]{1,64}$/)
	.refine((id) => !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id));

export const championAssetClassesSchema = z
	.array(z.enum(["fighter", "tank", "mage", "assassin", "marksman", "support"]))
	.min(1)
	.max(6)
	.refine((classes) => new Set(classes).size === classes.length);

const championAssetIdentity = {
	id: championAssetIdSchema,
	key: z.number().int().min(1).max(9999),
	classes: championAssetClassesSchema,
};

const championName = z.string().min(1).max(128);
const championTitle = z.string().min(1).max(256);

export const localizedChampionAssetSchema = z.strictObject({
	...championAssetIdentity,
	name: championName,
	title: championTitle,
});
export type LocalizedChampionAsset = z.infer<
	typeof localizedChampionAssetSchema
>;

function uniqueChampions(champions: readonly { id: string; key: number }[]) {
	return (
		new Set(champions.map(({ id }) => id.toLowerCase())).size ===
			champions.length &&
		new Set(champions.map(({ key }) => key)).size === champions.length
	);
}

export const localizedChampionCatalogSchema = z
	.array(localizedChampionAssetSchema)
	.min(1)
	.max(maxAssetChampions)
	.refine(uniqueChampions, "Duplicate champion identity");

export const championCatalogSchema = z
	.array(
		z.strictObject({
			...championAssetIdentity,
			names: z.strictObject({ es: championName, en: championName }),
			titles: z.strictObject({ es: championTitle, en: championTitle }),
		}),
	)
	.min(1)
	.max(maxAssetChampions)
	.refine(uniqueChampions, "Duplicate champion identity");
export type ChampionCatalog = z.infer<typeof championCatalogSchema>;

export interface AssetProgress {
	readonly completed: number;
	readonly total: number;
	/** Verified installed version available during a background startup update. */
	readonly cachedVersion?: string;
	/**
	 * The cache lacks assets the app uses (#555): startup keeps the loading
	 * screen until they are downloaded.
	 */
	readonly incomplete?: boolean;
}

export type AssetStatus =
	| { state: "missing" }
	| { state: "syncing"; progress: AssetProgress }
	/** `incomplete`: usable, but some official assets are missing (offline). */
	| { state: "ready"; version: string; incomplete?: true }
	| { state: "error" };
