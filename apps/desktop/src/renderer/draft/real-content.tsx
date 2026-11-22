import {
	type ChampionCatalog,
	CONTRACT_VERSION,
	type SeriesOptions,
} from "@rift-legends/contracts";
import { useOptionalAssets } from "../assets";
import { useCoreQuery } from "../core";

/** Why real content cannot be chosen yet (plan 11, A1). */
export type RealBlock =
	| "checking"
	| "missing"
	| "syncing"
	| "error"
	| "partial";

const noFact = () => false;

/**
 * Whether the asset cache can show the real content: a verified champion
 * catalog that names every champion of the real pool. `null` when it can.
 */
export function useRealBlock(sessionId: number): RealBlock | null {
	const assets = useOptionalAssets();
	const catalog = assets?.status?.state === "ready" ? assets.champions : null;
	const pool = useCoreQuery<SeriesOptions>(
		{
			v: CONTRACT_VERSION,
			kind: "series.options",
			sessionId,
			params: { content: "real" },
		},
		{ affectedBy: noFact, enabled: catalog !== null },
	);
	if (!catalog) {
		if (!assets?.status) return assets ? "checking" : "missing";
		const { state } = assets.status;
		return state === "syncing" || state === "error" ? state : "missing";
	}
	if (!pool.data) return pool.error ? "error" : "checking";
	const known = new Set(catalog.map((champion) => champion.id));
	return pool.data.pool.every((id) => known.has(id)) ? null : "partial";
}

/** `options` with each champion named from the cache in `language` (R4). */
export function localizeChampions(
	options: SeriesOptions,
	catalog: ChampionCatalog | null | undefined,
	language: string,
): SeriesOptions {
	if (!catalog) return options;
	const locale = language.startsWith("es") ? "es" : "en";
	const names = new Map(catalog.map((c) => [c.id, c.names[locale]]));
	return {
		...options,
		champions: options.champions.map((champion) => ({
			...champion,
			name: names.get(champion.id) ?? champion.name,
		})),
	};
}
